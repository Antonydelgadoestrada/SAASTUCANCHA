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
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { Promotion } from './promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { CalculatePromotionPriceDto } from './dto/calculate-promotion-price.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { ClubPermissionGuard } from '../common/guards/club-permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

function getEffectiveClubId(user: User): string {
  const clubId = user.club?.id || user.assignedClub?.id || (user as any).assignedClubId;
  if (!clubId && user.role !== UserRole.ADMIN) {
    throw new ForbiddenException('No tienes un club asociado para gestionar promociones');
  }
  return clubId;
}

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * Obtiene todas las promociones del club autenticado.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Get()
  findAllByClub(@GetUser() user: User): Promise<Promotion[]> {
    const clubId = getEffectiveClubId(user);
    return this.promotionService.findAllByClub(clubId);
  }

  /**
   * Obtiene las promociones activas aplicables a una cancha específica.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Get('court/:courtId')
  findActiveByCourt(
    @Param('courtId') courtId: string,
    @GetUser() user: User,
  ): Promise<Promotion[]> {
    const clubId = getEffectiveClubId(user);
    return this.promotionService.findActiveByCourt(clubId, courtId);
  }

  /**
   * Cotiza y calcula el precio validado con promociones para un turno.
   * Accesible para usuarios autenticados (clientes, club, recepcionista).
   */
  @UseGuards(JwtAuthGuard)
  @Post('calculate-price')
  calculatePrice(
    @Body() dto: CalculatePromotionPriceDto,
    @GetUser() user: User,
  ) {
    const clubId =
      user.role === UserRole.CLUB || user.role === UserRole.RECEPCIONISTA
        ? user.club?.id || user.assignedClub?.id
        : undefined;

    return this.promotionService.calculatePrice(dto, clubId);
  }

  /**
   * Crea una nueva promoción para el club autenticado.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Post()
  create(
    @Body() dto: CreatePromotionDto,
    @GetUser() user: User,
  ): Promise<Promotion> {
    const clubId = getEffectiveClubId(user);
    return this.promotionService.createForClub(dto, clubId);
  }

  /**
   * Obtiene una promoción específica asegurando aislamiento por club.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<Promotion> {
    const clubId = user.role !== UserRole.ADMIN ? getEffectiveClubId(user) : undefined;
    return this.promotionService.findOneScoped(id, clubId);
  }

  /**
   * Actualiza una promoción existente.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @GetUser() user: User,
  ): Promise<Promotion> {
    const clubId = getEffectiveClubId(user);
    return this.promotionService.updateForClub(id, dto, clubId);
  }

  /**
   * Conmuta el estado activo/inactivo (pausar o reactivar) de una promoción.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Patch(':id/toggle')
  toggleActive(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<Promotion> {
    const clubId = getEffectiveClubId(user);
    return this.promotionService.toggleActive(id, clubId);
  }

  /**
   * Elimina una promoción perteneciente al club autenticado.
   */
  @UseGuards(JwtAuthGuard, ClubPermissionGuard)
  @RequirePermission('dashboard')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    const clubId = getEffectiveClubId(user);
    return this.promotionService.removeForClub(id, clubId);
  }
}
