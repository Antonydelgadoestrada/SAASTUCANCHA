import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Club } from './club.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { S3Service } from '../aws/s3.service';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';

@Injectable()
export class ClubService {
  constructor(
    @InjectRepository(Club)
    private readonly repo: Repository<Club>,
    private readonly s3Service: S3Service
  ) {}

  findAll() {
    return this.repo.find({ relations: ['owner'] });
  }

  findAllTop() {
    return this.repo.find({
      relations: ['owner'],
      order: { createdAt: 'ASC' }, // primeros creados
      take: 10,
    });
  }

  findAllWithToken() {
    return this.repo.find({
      where: {
        mpTokenExpiresAt: Not(IsNull()),
      },
      relations: ['owner'],
    });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['owner'] });
  }

  create(data: Partial<Club>) {
    const club = this.repo.create(data);
    return this.repo.save(club);
  }

  async update(id: string, data: Partial<Club>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
  findByConditicion(where: Object) {
    return this.repo.findOne({ where: where });
  }

  uploadFiles(images:any[]){
    if(images.length == 0) return []
    return this.s3Service.uploadFiles(images, '/curt')
  }

  async approveClub(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
  
    club.status = 'APPROVED';
    club.approvedAt = new Date();

    if (!club.trialStartDate) {
      club.trialStartDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      club.trialEndDate = endDate;
    }
  
    return this.repo.save(club);
  }

  async suspendClub(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
  
    club.status = 'SUSPENDED';
    return this.repo.save(club);
  }

  async reactivateClub(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
  
    club.status = 'APPROVED';
    club.trialStartDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    club.trialEndDate = endDate;
  
    return this.repo.save(club);
  }

  async rejectClub(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
  
    club.status = 'REJECTED';
    club.approvedAt = new Date();
  
    return this.repo.save(club);
  }

  async updateClubWithMP(user_id, access_token, refresh_token, clubId, tokenExpiresAt){
    return this.repo.update(clubId, {mpUserId: user_id, mpAccessToken: access_token, mpRefreshToken:refresh_token, mpTokenExpiresAt:tokenExpiresAt})
  }

  async getPaymentConfig(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
    return {
      aceptaMercadopago: club.aceptaMercadopago ?? false,
      whatsapp: club.whatsapp || null,
      yapeNumero: club.yapeNumero,
      yapeQrUrl: club.yapeQrUrl,
      plinNumero: club.plinNumero,
      plinQrUrl: club.plinQrUrl,
      porcentajeAdelantoDefault: club.porcentajeAdelantoDefault ?? 50,
      adelantoMinimo: club.adelantoMinimo ? Number(club.adelantoMinimo) : null,
    };
  }

  async updatePaymentConfig(id: string, dto: any, user: User) {
    const club = await this.repo.findOne({ where: { id }, relations: ['owner'] });
    if (!club) throw new NotFoundException('Club no encontrado');

    const isOwner = club.owner?.id === user.id || club.id === user.club?.id;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new BadRequestException('No tienes permisos para modificar la configuración de pagos de este club');
    }

    if (dto.whatsapp !== undefined) club.whatsapp = dto.whatsapp ? dto.whatsapp.trim() : null;
    if (dto.aceptaMercadopago !== undefined) club.aceptaMercadopago = dto.aceptaMercadopago;
    if (dto.yapeNumero !== undefined) club.yapeNumero = dto.yapeNumero;
    if (dto.yapeQrUrl !== undefined) club.yapeQrUrl = dto.yapeQrUrl;
    if (dto.plinNumero !== undefined) club.plinNumero = dto.plinNumero;
    if (dto.plinQrUrl !== undefined) club.plinQrUrl = dto.plinQrUrl;
    if (dto.porcentajeAdelantoDefault !== undefined) club.porcentajeAdelantoDefault = dto.porcentajeAdelantoDefault;
    if (dto.adelantoMinimo !== undefined) club.adelantoMinimo = dto.adelantoMinimo;

    const saved = await this.repo.save(club);
    return {
      aceptaMercadopago: saved.aceptaMercadopago,
      whatsapp: saved.whatsapp || null,
      yapeNumero: saved.yapeNumero,
      yapeQrUrl: saved.yapeQrUrl,
      plinNumero: saved.plinNumero,
      plinQrUrl: saved.plinQrUrl,
      porcentajeAdelantoDefault: saved.porcentajeAdelantoDefault,
      adelantoMinimo: saved.adelantoMinimo ? Number(saved.adelantoMinimo) : null,
    };
  }

  async findClubByUser(user: User): Promise<Club> {
    if (user.club?.id) {
      const club = await this.repo.findOne({ where: { id: user.club.id }, relations: ['owner'] });
      if (club) return club;
    }
    const clubByOwner = await this.repo.findOne({ where: { owner: { id: user.id } }, relations: ['owner'] });
    if (clubByOwner) return clubByOwner;
    throw new NotFoundException('No se encontró un club asociado a tu usuario.');
  }

  /**
   * Sube un archivo de imagen QR para el club.
   * @param file - Archivo de imagen (PNG, JPG, WEBP)
   * @param user - Usuario autenticado (dueño del club)
   * @param walletType - 'yape' (default) o 'plin'
   */
  async uploadQr(file: any, user: User, walletType: 'yape' | 'plin' = 'yape'): Promise<{ url: string; wallet: string }> {
    if (!file) throw new BadRequestException('Debe proporcionar un archivo de imagen para el código QR.');
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen (PNG, JPG, WEBP).');
    }
    const club = await this.findClubByUser(user);
    const safeName = (file.originalname || `qr-${walletType}.png`).replace(/\s+/g, '_');
    const url = await this.s3Service.uploadFile(file.buffer, safeName, file.mimetype, `club-qrs/${walletType}`);

    if (walletType === 'plin') {
      club.plinQrUrl = url;
    } else {
      club.yapeQrUrl = url;
    }
    await this.repo.save(club);
    return { url, wallet: walletType };
  }
}
