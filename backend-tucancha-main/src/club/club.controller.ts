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
  } from '@nestjs/common';
  import { ClubService } from './club.service';
  import { Club } from './club.entity';
import { ClubPublicDto, CreateClubDto } from './dto/create-club.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage,  File as MulterFile } from 'multer';
import { plainToInstance } from 'class-transformer';

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

  }
  