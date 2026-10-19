
import { Controller, Get, Param, Put, Post, Patch, Body, Delete, UseGuards, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

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

  private getClubIdFromUser(user: User): string {
    const clubId = user.club?.id || user.clubId;
    if (!clubId) {
      throw new ForbiddenException('No tienes un club asociado para gestionar personal');
    }
    return clubId;
  }

  @UseGuards(JwtAuthGuard)
  @Get('club/staff')
  async getClubStaff(@GetUser() user: User) {
    if (user.role !== UserRole.CLUB && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para ver el personal del club');
    }
    const clubId = this.getClubIdFromUser(user);
    return this.userService.findStaffByClub(clubId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('club/staff')
  async createClubStaff(@Body() dto: CreateStaffDto, @GetUser() user: User) {
    if (user.role !== UserRole.CLUB && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para registrar personal del club');
    }
    const clubId = this.getClubIdFromUser(user);
    return this.userService.createStaffUser(clubId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('club/staff/:id')
  async updateClubStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @GetUser() user: User,
  ) {
    if (user.role !== UserRole.CLUB && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para modificar personal del club');
    }
    const clubId = this.getClubIdFromUser(user);
    return this.userService.updateStaffUser(clubId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('club/staff/:id/toggle-status')
  async toggleStaffStatus(@Param('id') id: string, @GetUser() user: User) {
    if (user.role !== UserRole.CLUB && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para cambiar el estado de este usuario');
    }
    const clubId = this.getClubIdFromUser(user);
    return this.userService.toggleStaffStatus(clubId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('club/staff/:id')
  async removeClubStaff(@Param('id') id: string, @GetUser() user: User) {
    if (user.role !== UserRole.CLUB && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para eliminar personal del club');
    }
    const clubId = this.getClubIdFromUser(user);
    return this.userService.removeStaffUser(clubId, id, user);
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
