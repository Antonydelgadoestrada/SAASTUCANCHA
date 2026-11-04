import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { UserService } from './user.service';
import { CreateClubUserDto } from './dto/create-club-user.dto';
import { UpdateClubUserDto } from './dto/update-club-user.dto';

@Controller('club/users')
@UseGuards(JwtAuthGuard)
export class ClubUserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Helper de seguridad para resolver el clubId de forma inviolable desde la sesión/token.
   * Rechaza cualquier intento de recepcionistas o usuarios no autorizados.
   */
  private getSecureClubId(user: User): string {
    if (user.role !== UserRole.CLUB && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador del club puede gestionar usuarios');
    }
    const clubId = user.club?.id || user.assignedClubId;
    if (!clubId) {
      throw new BadRequestException('El usuario no posee un club asignado');
    }
    return clubId;
  }

  @Get()
  async getStaffUsers(@GetUser() user: User) {
    const clubId = this.getSecureClubId(user);
    return this.userService.findStaffByClub(clubId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createStaffUser(
    @GetUser() user: User,
    @Body() dto: CreateClubUserDto,
  ) {
    const clubId = this.getSecureClubId(user);
    return this.userService.createStaffUser(clubId, dto);
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateStaffUser(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateClubUserDto,
  ) {
    const clubId = this.getSecureClubId(user);
    return this.userService.updateStaffUser(clubId, id, dto);
  }

  @Patch(':id/status')
  async toggleStaffStatus(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const clubId = this.getSecureClubId(user);
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('El campo isActive debe ser booleano');
    }
    return this.userService.toggleStaffStatus(clubId, id, isActive);
  }

  @Delete(':id')
  async deleteStaffUser(
    @GetUser() user: User,
    @Param('id') id: string,
  ) {
    const clubId = this.getSecureClubId(user);
    return this.userService.softDeleteStaffUser(clubId, id);
  }
}
