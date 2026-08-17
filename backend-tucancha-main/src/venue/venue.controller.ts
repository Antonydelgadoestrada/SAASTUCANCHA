// src/venue/venue.controller.ts
import { Controller, Get, Post, Param, Body, Put, Delete, UseGuards, ForbiddenException } from '@nestjs/common';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { CreateVenueDto } from './dto/create-venue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../user/user.entity';
import { GetUser } from '../auth/get-user.decorator';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Get()
  findAll(): Promise<Venue[]> {
    return this.venueService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('club')
  findAllByClub(@GetUser() user: User): Promise<Venue[]> {
    if (user.role !== 'CLUB') {
      throw new ForbiddenException('No tienes permisos para listar sedes');
    }
    return this.venueService.findAllByClub(user.club);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Venue> {
    return this.venueService.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() data: CreateVenueDto, @GetUser() user: User){
    if (user.role !== 'CLUB') {
      throw new ForbiddenException('No tienes permisos para crear sedes');
    }
    return this.venueService.create(data, user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<Venue>): Promise<Venue> {
    return this.venueService.update(Number(id), data);
  }
  
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<Venue> {
    return this.venueService.remove(Number(id));
  }
}
