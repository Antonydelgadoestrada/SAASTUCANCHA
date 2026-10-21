import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { LoyaltyService } from './loyalty.service';
import { RedeemRewardDto } from './dto/loyalty-redemption.dto';

@Controller('loyalty/user')
@UseGuards(JwtAuthGuard)
export class LoyaltyUserController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // 1. Obtener balance de puntos y cantidad de reservas pagadas del usuario en el club
  @Get('balance/:clubId')
  async getBalance(
    @GetUser() user: Partial<User>,
    @Param('clubId') clubId: string,
  ) {
    return await this.loyaltyService.getUserBalance(clubId, user.id);
  }

  // 2. Listar premios activos disponibles para canje en el club
  @Get('rewards/:clubId')
  async getRewards(@Param('clubId') clubId: string) {
    return await this.loyaltyService.getRewards(clubId, true);
  }

  // 3. Solicitar canje de un premio
  @Post('redeem')
  async redeemReward(
    @GetUser() user: Partial<User>,
    @Body() dto: RedeemRewardDto,
  ) {
    return await this.loyaltyService.redeemReward({
      clubId: dto.clubId,
      userId: user.id,
      rewardId: dto.rewardId,
    });
  }

  // 4. Historial de canjes del usuario en el club
  @Get('redemptions/:clubId')
  async getRedemptions(
    @GetUser() user: Partial<User>,
    @Param('clubId') clubId: string,
  ) {
    return await this.loyaltyService.getUserRedemptions(clubId, user.id);
  }

  // 5. Historial de transacciones de puntos del usuario en el club
  @Get('transactions/:clubId')
  async getTransactions(
    @GetUser() user: Partial<User>,
    @Param('clubId') clubId: string,
    @Query('limit') limit?: number,
  ) {
    return await this.loyaltyService.getUserTransactions(
      clubId,
      user.id,
      limit ? Number(limit) : 50,
    );
  }
}
