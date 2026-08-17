
// src/user/user.controller.ts
import { Controller, Get, Param, Put, Post, Body, Delete, UseGuards, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get("/club")
  findAll(@GetUser() user: User): Promise<User[]> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para listar sedes');
    }
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/admin/dashboard-stats')
  async getDashboardStats(@GetUser() user: User) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para ver estadísticas');
    }
    return this.userService.getAdminDashboardStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findOneById(id);
  }

  @Post()
  create(@Body() userData: Partial<User>): Promise<User> {
    return this.userService.create(userData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() userData: Partial<User>, @GetUser() user: User): Promise<User> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos para listar sedes');
    }
    return this.userService.update(id, userData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
