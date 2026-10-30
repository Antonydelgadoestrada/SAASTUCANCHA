import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CourtService } from './court.service';
import { Court } from './court.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage, File as MulterFile } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { GetUser } from '../auth/get-user.decorator';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from '../club/club.entity';
import { MembershipService } from '../membership/membership.service';

@Controller('courts')
export class CourtController {
  constructor(
    private readonly service: CourtService,
    @InjectRepository(Club)
    private readonly clubRepo: Repository<Club>,
    private readonly membershipService: MembershipService,
  ) {}

  @Get()
  findAll(): Promise<Court[]> {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/club')
  findAllByClub(@GetUser() user: User): Promise<Court[]> {
    const canList =
      user.role === UserRole.CLUB ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.RECEPCIONISTA && user.permissions?.includes('courts'));
    if (!canList) {
      throw new ForbiddenException('No tienes permisos para listar canchas');
    }
    return this.service.findAllByClub(user.club.id);
  }

  @Get('query')
  findAllByQuery(@Query() query: any) {
    return this.service.findAllWithFilters(query);
  }

  @Get('featured')
  async featured(
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('onlyWithImage') onlyWithImage?: string,
  ) {
    return this.service.findFeaturedPublic({
      limit: limit ? Number(limit) : undefined,
      sort,
      onlyWithImage: onlyWithImage === 'true',
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Court> {
    const court = await this.service.findOne(id);
    if (!court) throw new NotFoundException('Court not found');
    return court;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
    }),
  )
  async create(
    @Body() data: any,
    @UploadedFiles() images: MulterFile[],
    @GetUser() user: User,
  ) {
    const canCreate =
      user?.role === UserRole.ADMIN ||
      user?.role === UserRole.CLUB ||
      (user?.role === UserRole.RECEPCIONISTA && user?.permissions?.includes('courts'));

    if (!canCreate) {
      throw new ForbiddenException('Solo los clubes y recepcionistas autorizados pueden crear canchas');
    }

    if (user?.role === UserRole.CLUB || user?.role === UserRole.RECEPCIONISTA) {
      if (!user.club?.id) {
        throw new ForbiddenException('El usuario no tiene un club asignado');
      }
      // Validar si el club ya configuró sus métodos de cobro
      const club = await this.clubRepo.findOne({ where: { id: user.club.id } });
      const hasYape = Boolean(club?.aceptaYape && club?.yapeNumero?.trim());
      const hasPlin = Boolean(club?.aceptaPlin && club?.plinNumero?.trim());
      const hasMp = Boolean(club?.aceptaMercadopago && club?.mpAccessToken);

      if (!hasYape && !hasPlin && !hasMp) {
        throw new BadRequestException(
          'Antes de publicar tus canchas, debes configurar tus métodos de cobro y pago (número de Yape, Plin o Mercado Pago) en el módulo "Pagos y Cobros".',
        );
      }

      // Validar límite de canchas según plan de membresía
      const activeMembership = await this.membershipService.getClubActiveMembership(user.club.id);
      if (activeMembership && activeMembership.plan && activeMembership.plan.maxCourts) {
        const currentCourts = await this.service.totalByClub(user.club.id);
        if (currentCourts >= activeMembership.plan.maxCourts) {
          throw new BadRequestException(
            `Has alcanzado el límite máximo de ${activeMembership.plan.maxCourts} canchas permitido por tu plan "${activeMembership.plan.name}". Mejora tu plan para agregar más canchas.`,
          );
        }
      }

      data.club = user.club.id;
    }

    const uploadedUrls = images?.length ? await this.service.uploadFiles(images) : [];
    return this.service.create(Object.assign(data, { images: uploadedUrls }));
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @UploadedFiles() images: MulterFile[],
    @GetUser() user: User,
  ) {
    const court = await this.service.findOne(id, ['club']);
    if (!court) throw new NotFoundException('Cancha no encontrada');

    const isAuthorized =
      user.role === UserRole.ADMIN ||
      (user.club &&
        user.club.id === court.club?.id &&
        (user.role === UserRole.CLUB ||
          (user.role === UserRole.RECEPCIONISTA && user.permissions?.includes('courts'))));

    if (!isAuthorized) {
      throw new ForbiddenException('No tienes permisos para modificar esta cancha');
    }

    let existingUrls: string[] = [];
    try {
      existingUrls = JSON.parse(data.existingImages || '[]');
    } catch {
      throw new BadRequestException('existingImages debe ser un JSON válido');
    }

    const uploadedUrls = images?.length ? await this.service.uploadFiles(images) : [];
    const allImages = [...existingUrls, ...uploadedUrls];

    delete data.existingImages;
    return this.service.update(id, { ...data, images: allImages });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @GetUser() user: User) {
    const court = await this.service.findOne(id, ['club']);
    if (!court) throw new NotFoundException('Cancha no encontrada');

    const isAuthorized =
      user.role === UserRole.ADMIN ||
      (user.club &&
        user.club.id === court.club?.id &&
        (user.role === UserRole.CLUB ||
          (user.role === UserRole.RECEPCIONISTA && user.permissions?.includes('courts'))));

    if (!isAuthorized) {
      throw new ForbiddenException('No tienes permisos para eliminar esta cancha');
    }
    return this.service.remove(id);
  }
}
