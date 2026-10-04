
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

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: User): Promise<User> {
    if (user.role !== 'ADMIN' && user.id !== id) {
      throw new ForbiddenException('No tienes permisos para consultar este usuario');
    }
    return this.userService.findOneById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() userData: Partial<User>, @GetUser() user: User): Promise<User> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo administradores pueden crear usuarios directamente');
    }
    return this.userService.create(userData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() userData: Partial<User>, @GetUser() user: User): Promise<User> {
    if (user.role !== 'ADMIN' && user.id !== id) {
      throw new ForbiddenException('No tienes permisos para modificar este usuario');
    }
    return this.userService.update(id, userData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @GetUser() user: User): Promise<void> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo administradores pueden eliminar usuarios');
    }
    return this.userService.remove(id);
  }
}
