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
import { GetUser } from '../auth/get-user.decorator';

  @Controller('courts')
  export class CourtController {
    constructor(private readonly service: CourtService) {}
  
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
      @Body() data: Partial<Court>,
      @UploadedFiles() images: MulterFile[],
      @GetUser() user: User
    ) {
      const urls = images?.length ? await this.service.uploadFiles(images) : []
      if (user?.club?.id) {
          (data as any).club = user.club.id;
      }
      return this.service.create({ ...data, images: urls })
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
      @UploadedFiles() images: MulterFile[]
    ) {
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
    remove(@Param('id') id: string) {
      return this.service.remove(id);
    }
  }
  