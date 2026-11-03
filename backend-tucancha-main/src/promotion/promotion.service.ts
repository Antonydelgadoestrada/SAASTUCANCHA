import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './promotion.entity';
import { Court } from '../court/court.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { CalculatePromotionPriceDto } from './dto/calculate-promotion-price.dto';
import { PromotionType } from './promotion-type.enum';
import {
  calculatePromotionPricing,
  PromotionCalculationResult,
  timeToMinutes,
} from './utils/promotion-calculator';

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
    @InjectRepository(Court)
    private readonly courtRepository: Repository<Court>,
  ) {}

  /**
   * Obtiene todas las promociones asociadas al club autenticado.
   */
  async findAllByClub(clubId: string): Promise<Promotion[]> {
    if (!clubId) throw new BadRequestException('ID de club no proporcionado');
    return this.promotionRepository.find({
      where: { clubId },
      relations: ['court'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene promociones activas para un club.
   */
  async findActiveByClub(clubId: string): Promise<Promotion[]> {
    if (!clubId) return [];
    return this.promotionRepository.find({
      where: { clubId, isActive: true },
      relations: ['court'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene promociones activas aplicables a una cancha específica (específicas + globales del club).
   */
  async findActiveByCourt(clubId: string, courtId: string): Promise<Promotion[]> {
    if (!clubId) return [];
    const query = this.promotionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.court', 'court')
      .where('p.clubId = :clubId', { clubId })
      .andWhere('p.isActive = true')
      .andWhere('(p.courtId = :courtId OR p.applyToAllCourts = true OR p.courtId IS NULL)', { courtId })
      .orderBy('p.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * Busca una promoción asegurando que pertenezca al club autenticado.
   */
  async findOneScoped(id: string, clubId?: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({
      where: { id },
      relations: ['court', 'club'],
    });

    if (!promotion) {
      throw new NotFoundException(`Promoción con ID ${id} no encontrada`);
    }

    if (clubId && promotion.clubId && promotion.clubId !== clubId) {
      throw new ForbiddenException('No tienes permisos para acceder a esta promoción');
    }

    return promotion;
  }

  /**
   * Crea una nueva promoción para el club autenticado validando franjas y pertenencia de cancha.
   */
  async createForClub(dto: CreatePromotionDto, clubId: string): Promise<Promotion> {
    if (!clubId) {
      throw new BadRequestException('Usuario no tiene un club asociado');
    }

    // Validar orden de franja horaria
    const startMins = timeToMinutes(dto.startTime);
    let endMins = timeToMinutes(dto.endTime);
    if (dto.endTime === '23:59' || (dto.endTime === '00:00' && startMins > 0)) {
      endMins = 1440;
    }

    if (startMins >= endMins) {
      throw new BadRequestException(
        `Hora de inicio (${dto.startTime}) debe ser menor que la hora de fin (${dto.endTime})`,
      );
    }

    // Validar pertenencia de la cancha al club
    let resolvedCourtId: string | null = null;
    let resolvedCourt: Court | null = null;

    if (!dto.applyToAllCourts && dto.courtId) {
      const court = await this.courtRepository.findOne({
        where: { id: dto.courtId },
        relations: ['club'],
      });

      if (!court) {
        throw new NotFoundException('La cancha seleccionada no existe');
      }

      if (court.club?.id && court.club.id !== clubId) {
        throw new ForbiddenException('La cancha seleccionada no pertenece a tu club');
      }

      resolvedCourtId = court.id;
      resolvedCourt = court;
    }

    const isGlobal = dto.applyToAllCourts === true || !resolvedCourtId;

    const promotion = this.promotionRepository.create({
      clubId,
      courtId: isGlobal ? null : resolvedCourtId,
      court: isGlobal ? null : resolvedCourt,
      applyToAllCourts: isGlobal,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      type: PromotionType.HAPPY_HOUR,
      startTime: dto.startTime,
      endTime: dto.endTime,
      daysOfWeek: dto.daysOfWeek && dto.daysOfWeek.length > 0 ? dto.daysOfWeek : [1, 2, 3, 4, 5, 6, 0],
      discountPercentage: dto.discountPercentage,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      discount: {
        type: 'percentage',
        value: dto.discountPercentage,
      },
    });

    return this.promotionRepository.save(promotion);
  }

  /**
   * Actualiza una promoción existente verificando pertenencia al club.
   */
  async updateForClub(id: string, dto: UpdatePromotionDto, clubId: string): Promise<Promotion> {
    const promotion = await this.findOneScoped(id, clubId);

    // Si se actualizan horarios, validar coherencia
    const effectiveStart = dto.startTime || promotion.startTime;
    const effectiveEnd = dto.endTime || promotion.endTime;

    const startMins = timeToMinutes(effectiveStart);
    let endMins = timeToMinutes(effectiveEnd);
    if (effectiveEnd === '23:59' || (effectiveEnd === '00:00' && startMins > 0)) {
      endMins = 1440;
    }

    if (startMins >= endMins) {
      throw new BadRequestException(
        `Hora de inicio (${effectiveStart}) debe ser menor que la hora de fin (${effectiveEnd})`,
      );
    }

    // Si se actualiza la cancha
    if (dto.applyToAllCourts !== undefined && dto.applyToAllCourts === true) {
      promotion.applyToAllCourts = true;
      promotion.courtId = null;
      promotion.court = null;
    } else if (dto.courtId !== undefined) {
      if (dto.courtId === null || dto.courtId === '') {
        promotion.applyToAllCourts = true;
        promotion.courtId = null;
        promotion.court = null;
      } else {
        const court = await this.courtRepository.findOne({
          where: { id: dto.courtId },
          relations: ['club'],
        });

        if (!court) {
          throw new NotFoundException('La cancha seleccionada no existe');
        }

        if (court.club?.id && court.club.id !== clubId) {
          throw new ForbiddenException('La cancha seleccionada no pertenece a tu club');
        }

        promotion.courtId = court.id;
        promotion.court = court;
        promotion.applyToAllCourts = false;
      }
    }

    if (dto.name !== undefined) promotion.name = dto.name.trim();
    if (dto.description !== undefined) promotion.description = dto.description?.trim();
    if (dto.startTime !== undefined) promotion.startTime = dto.startTime;
    if (dto.endTime !== undefined) promotion.endTime = dto.endTime;
    if (dto.daysOfWeek !== undefined) promotion.daysOfWeek = dto.daysOfWeek;
    if (dto.discountPercentage !== undefined) {
      promotion.discountPercentage = dto.discountPercentage;
      promotion.discount = { type: 'percentage', value: dto.discountPercentage };
    }
    if (dto.startDate !== undefined) promotion.startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    if (dto.endDate !== undefined) promotion.endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    if (dto.isActive !== undefined) promotion.isActive = dto.isActive;

    return this.promotionRepository.save(promotion);
  }

  /**
   * Conmuta el estado activo/inactivo de una promoción.
   */
  async toggleActive(id: string, clubId: string): Promise<Promotion> {
    const promotion = await this.findOneScoped(id, clubId);
    promotion.isActive = !promotion.isActive;
    return this.promotionRepository.save(promotion);
  }

  /**
   * Elimina una promoción verificando permisos de club.
   */
  async removeForClub(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
    const promotion = await this.findOneScoped(id, clubId);
    await this.promotionRepository.delete(promotion.id);
    return { success: true, message: 'Promoción eliminada exitosamente' };
  }

  /**
   * Cotiza y calcula el precio oficial aplicando promociones vigentes para una cancha, fecha y turno.
   */
  async calculatePrice(
    dto: CalculatePromotionPriceDto,
    scopedClubId?: string,
  ): Promise<PromotionCalculationResult> {
    const court = await this.courtRepository.findOne({
      where: { id: dto.courtId },
      relations: ['club'],
    });

    if (!court) {
      throw new NotFoundException('Cancha no encontrada');
    }

    const clubId = court.club?.id;
    if (scopedClubId && clubId && scopedClubId !== clubId) {
      throw new ForbiddenException('No tienes permisos para cotizar turnos en este club');
    }

    // Obtener promociones activas para el club y cancha
    const promotions = clubId
      ? await this.findActiveByCourt(clubId, court.id)
      : [];

    return calculatePromotionPricing({
      date: dto.date,
      startTime: dto.startTime,
      duration: dto.duration,
      court: {
        id: court.id,
        name: court.name,
        priceDay: Number(court.priceDay) || 0,
        priceNight: court.priceNight ? Number(court.priceNight) : null,
        promoDay: court.promoDay ? Number(court.promoDay) : null,
        promoNight: court.promoNight ? Number(court.promoNight) : null,
      },
      promotions,
    });
  }

  // --- Métodos de retrocompatibilidad ---
  findAll() {
    return this.promotionRepository.find({ relations: ['court', 'club'] });
  }

  findOne(id: string) {
    return this.promotionRepository.findOne({ where: { id }, relations: ['court', 'club'] });
  }

  create(data: Partial<Promotion>) {
    const promotion = this.promotionRepository.create(data);
    return this.promotionRepository.save(promotion);
  }

  async update(id: string, data: Partial<Promotion>) {
    await this.promotionRepository.update(id, data);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.promotionRepository.delete(id);
  }
}
