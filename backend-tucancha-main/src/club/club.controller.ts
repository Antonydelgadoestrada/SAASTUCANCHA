import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    NotFoundException,
    Patch,
    UseGuards,
    UseInterceptors,
    UploadedFiles,
    UploadedFile,
    Query,
  } from '@nestjs/common';
  import { ClubService } from './club.service';
  import { Club } from './club.entity';
import { ClubPublicDto, CreateClubDto } from './dto/create-club.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage,  File as MulterFile } from 'multer';
import { plainToInstance } from 'class-transformer';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { UpdateClubPaymentConfigDto } from './dto/update-club-payment-config.dto';

  @Controller('clubs')
  export class ClubController {
    constructor(private readonly service: ClubService) {}
  
    @Get()
    async findAll(): Promise<ClubPublicDto[]> {
      const clubs = await this.service.findAll();
      return plainToInstance(ClubPublicDto, clubs, { excludeExtraneousValues: true });
    }
    
    @Get('/limit')
    async findAllTop(): Promise<ClubPublicDto[]> {
      const clubs = await this.service.findAllTop();
      return plainToInstance(ClubPublicDto, clubs, { excludeExtraneousValues: true });
    }

    // ─── RUTAS DEL CLUB AUTENTICADO (definidas antes de :id) ────────────

    @UseGuards(JwtAuthGuard)
    @Get('my/config-pagos')
    async getMyConfigPagos(@GetUser() user: User) {
      const club = await this.service.findClubByUser(user);
      return this.service.getPaymentConfig(club.id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('my/config-pagos')
    async updateMyConfigPagos(
      @Body() dto: UpdateClubPaymentConfigDto,
      @GetUser() user: User,
    ) {
      const club = await this.service.findClubByUser(user);
      return this.service.updatePaymentConfig(club.id, dto, user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('my/upload-qr')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    async uploadQr(
      @UploadedFile() file: MulterFile,
      @GetUser() user: User,
      @Query('type') type: 'yape' | 'plin' = 'yape',
    ) {
      const walletType: 'yape' | 'plin' = type === 'plin' ? 'plin' : 'yape';
      return this.service.uploadQr(file, user, walletType);
    }

    @Get(':id/config-pagos')
    async getConfigPagos(@Param('id') id: string) {
      return this.service.getPaymentConfig(id);
    }

    @Get(':id/payment-config')
    async getPaymentConfig(@Param('id') id: string) {
      return this.service.getPaymentConfig(id);
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<ClubPublicDto> {
      const club = await this.service.findOne(id);
      if (!club) throw new NotFoundException('Club not found');
      return plainToInstance(ClubPublicDto, club, { excludeExtraneousValues: true });
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    @UseInterceptors(
      FilesInterceptor('images', 10, {
        storage: memoryStorage(), // muy importante: subir desde buffer
      })
    )
    async create(
      @Body() createClubDto: CreateClubDto,
      @UploadedFiles() images: MulterFile[]
    ): Promise<ClubPublicDto> {
      const urls = await this.service.uploadFiles(images)
      const created = await this.service.create({ ...createClubDto, images: urls });
      return plainToInstance(ClubPublicDto, created, { excludeExtraneousValues: true });
    }
  
    @Put(':id')
    @UseInterceptors(
      FilesInterceptor('images', 10, {
        storage: memoryStorage(), // muy importante: subir desde buffer
      })
    )
    async update(@Param('id') id: string, 
          @Body() data: Partial<Club>,
          @UploadedFiles() images: MulterFile[]
    ){
      const urls = await this.service.uploadFiles(images)
      if(urls.length>0) data = Object.assign(data,{images:urls})
      return this.service.update(id, data);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.service.remove(id);
    }

    @Patch('approve/:id')
    async approveClub(@Param('id') id: string) {
      return this.service.approveClub(id);
    }

    @Patch('reject/:id')
    async rejectClub(@Param('id') id: string) {
      return this.service.rejectClub(id);
    }

    @Patch('suspend/:id')
    async suspendClub(@Param('id') id: string) {
      return this.service.suspendClub(id);
    }

    @Patch('reactivate/:id')
    async reactivateClub(@Param('id') id: string) {
      return this.service.reactivateClub(id);
    }

  }