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
  import { memoryStorage,  File as MulterFile } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
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
      if (user.role !== 'CLUB') {
        throw new ForbiddenException('No tienes permisos para listar canchas');
      }
      return this.service.findAllByClub(user.club.id);
    }
    
    @Get('query')
    findAllByQuery(@Query() query: any) {
      return this.service.findAllWithFilters(query)
    }

     @Get('featured')
    async featured(
      @Query('limit') limit?: string,
      @Query('sort') sort?: string, // ej. "createdAt:asc"
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
        storage: memoryStorage(), // muy importante: subir desde buffer
      }),
    )
    async create(
      @Body() data: any,
      @UploadedFiles() images: MulterFile[],
      @GetUser() user: User
    ) {
      if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.CLUB) {
        throw new ForbiddenException('Solo los clubes y administradores pueden crear canchas');
      }

      if (user?.role === UserRole.CLUB) {
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
            'Antes de publicar tus canchas, debes configurar tus métodos de cobro y pago (número de Yape, Plin o Mercado Pago) en el módulo "Pagos y Cobros".'
          );
        }

        // Validate maximum courts allowed by membership plan
        const activeMembership = await this.membershipService.getClubActiveMembership(user.club.id);
        const maxCourts = activeMembership?.plan?.maxCourts || 6;
        const currentCourts = await this.service.totalByClub(user.club.id);
        if (currentCourts >= maxCourts) {
          throw new BadRequestException(
            `Exceso de canchas: tu membresía actual solo permite la creación de un máximo de ${maxCourts} canchas. Contacta con el administrador.`
          );
        }

        data.club = user.club.id;
      }

      let existingUrls: string[] = [];
      if (data.existingImages) {
        try {
          existingUrls = typeof data.existingImages === 'string' ? JSON.parse(data.existingImages) : data.existingImages;
        } catch {
          existingUrls = [];
        }
      } else if (data.images) {
        if (Array.isArray(data.images)) existingUrls = data.images;
        else if (typeof data.images === 'string') {
          try {
            existingUrls = JSON.parse(data.images);
          } catch {
            existingUrls = [data.images];
          }
        }
      }

      const uploadedUrls = images?.length ? await this.service.uploadFiles(images) : [];
      const allImages = [...(Array.isArray(existingUrls) ? existingUrls : []), ...uploadedUrls];

      delete data.existingImages;
      return this.service.create({ ...data, images: allImages });
    }
    
    @UseGuards(JwtAuthGuard)
    @Put(':id')
    @UseInterceptors(
      FilesInterceptor('images', 10, {
        storage: memoryStorage(), // muy importante: subir desde buffer
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB por archivo
        },
      }),
    )
    async update(@Param('id') id: string,
      @Body() data: any,
      @UploadedFiles() images: MulterFile[],
      @GetUser() user: User,
    ) {
      const court = await this.service.findOne(id, ['club']);
      if (!court) throw new NotFoundException('Cancha no encontrada');
      if (user.role !== UserRole.ADMIN && (!user.club || user.club.id !== court.club?.id)) {
        throw new ForbiddenException('No tienes permisos para modificar esta cancha');
      }

      let existingUrls: string[] = []

      try {
        existingUrls = JSON.parse(data.existingImages || '[]')
      } catch {
        throw new BadRequestException('existingImages debe ser un JSON válido')
      }

      const uploadedUrls = images?.length ? await this.service.uploadFiles(images) : []
      const allImages = [...existingUrls, ...uploadedUrls]

      delete data.existingImages
      return this.service.update(id, { ...data, images: allImages})
    }
    
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async remove(@Param('id') id: string, @GetUser() user: User) {
      const court = await this.service.findOne(id, ['club']);
      if (!court) throw new NotFoundException('Cancha no encontrada');
      if (user.role !== UserRole.ADMIN && (!user.club || user.club.id !== court.club?.id)) {
        throw new ForbiddenException('No tienes permisos para eliminar esta cancha');
      }
      return this.service.remove(id);
    }
  }
  