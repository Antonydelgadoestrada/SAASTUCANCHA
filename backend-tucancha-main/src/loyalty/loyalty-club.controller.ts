import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { LoyaltyService } from './loyalty.service';
import { UpdateLoyaltyConfigDto } from './dto/loyalty-config.dto';
import {
  CreateLoyaltyRewardDto,
  UpdateLoyaltyRewardDto,
} from './dto/loyalty-reward.dto';
import {
  DeliverRewardDto,
  RejectRedemptionDto,
} from './dto/loyalty-redemption.dto';
import { PreviewCouponDto } from './dto/preview-coupon.dto';
import { LoyaltyRedemptionStatus } from './entities/loyalty_redemption.entity';

@Controller('loyalty/club')
@UseGuards(JwtAuthGuard)
export class LoyaltyClubController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  /**
   * Validador estricto de Tenant: Siempre extrae el clubId del usuario autenticado en JWT.
   * Prohíbe que el frontend envíe un clubId para afectar a otro tenant.
   * Si es ADMIN, permite targetClubId si se envía en la query.
   */
  private getClubIdOrThrow(user: Partial<User>, targetClubId?: string): string {
    if (user?.role === UserRole.ADMIN && targetClubId) {
      return targetClubId;
    }
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.CLUB) {
      throw new ForbiddenException(
        'Acceso restringido: no tienes permisos de club o administración',
      );
    }
    if (!user?.club?.id) {
      throw new ForbiddenException(
        'Acceso restringido: no tienes un club asociado a tu cuenta',
      );
    }
    return user.club.id;
  }

  // 1. Obtener configuración del programa de fidelidad
  @Get('config')
  async getConfig(@GetUser() user: Partial<User>) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.getConfig(clubId);
  }

  // 2. Actualizar configuración del programa de fidelidad
  @Put('config')
  async updateConfig(
    @GetUser() user: Partial<User>,
    @Body() dto: UpdateLoyaltyConfigDto,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.updateConfig(clubId, dto);
  }

  // 3. Listar catálogo de premios del club (incluyendo inactivos para gestión)
  @Get('rewards')
  async getRewards(@GetUser() user: Partial<User>) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.getRewards(clubId, false);
  }

  // 4. Crear nuevo premio
  @Post('rewards')
  async createReward(
    @GetUser() user: Partial<User>,
    @Body() dto: CreateLoyaltyRewardDto,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.createReward(clubId, dto);
  }

  // 5. Editar premio existente
  @Put('rewards/:id')
  async updateReward(
    @GetUser() user: Partial<User>,
    @Param('id') id: string,
    @Body() dto: UpdateLoyaltyRewardDto,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.updateReward(clubId, id, dto);
  }

  // 6. Desactivar / eliminar premio
  @Delete('rewards/:id')
  async deleteReward(
    @GetUser() user: Partial<User>,
    @Param('id') id: string,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    await this.loyaltyService.deleteReward(clubId, id);
    return { success: true, message: 'Premio desactivado exitosamente' };
  }

  // 7. Listar historial de canjes del club
  @Get('redemptions')
  async getRedemptions(
    @GetUser() user: Partial<User>,
    @Query('status') status?: LoyaltyRedemptionStatus,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.getClubRedemptions(clubId, status);
  }

  // 8. Entregar premio por código
  @Post('redemptions/deliver')
  async deliverReward(
    @GetUser() user: Partial<User>,
    @Body() dto: DeliverRewardDto,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.deliverReward({
      clubId,
      code: dto.code,
      staffUserId: user.id,
    });
  }

  // 9. Rechazar canje y reembolsar puntos
  @Post('redemptions/:id/reject')
  async rejectRedemption(
    @GetUser() user: Partial<User>,
    @Param('id') id: string,
    @Body() dto: RejectRedemptionDto,
  ) {
    const clubId = this.getClubIdOrThrow(user);
    return await this.loyaltyService.rejectRedemption({
      clubId,
      redemptionId: id,
      reason: dto.reason,
      staffUserId: user.id,
    });
  }

  // 10. Previsualizar cupón de descuento o hora gratis (Nivel 2)
  @Post('coupons/preview')
  async previewCoupon(
    @GetUser() user: Partial<User>,
    @Body() dto: PreviewCouponDto,
    @Query('clubId') queryClubId?: string,
  ) {
    const clubId = this.getClubIdOrThrow(user, queryClubId);
    return await this.loyaltyService.previewCoupon(clubId, dto);
  }
}
