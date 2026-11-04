import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyConfig } from './entities/loyalty_config.entity';
import { LoyaltyReward } from './entities/loyalty_reward.entity';
import { LoyaltyBalance } from './entities/loyalty_balance.entity';
import { LoyaltyRedemption } from './entities/loyalty_redemption.entity';
import { LoyaltyTransaction } from './entities/loyalty_transaction.entity';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyClubController } from './loyalty-club.controller';
import { LoyaltyUserController } from './loyalty-user.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoyaltyConfig,
      LoyaltyReward,
      LoyaltyBalance,
      LoyaltyRedemption,
      LoyaltyTransaction,
    ]),
  ],
  controllers: [LoyaltyClubController, LoyaltyUserController],
  providers: [LoyaltyService],
  exports: [LoyaltyService, TypeOrmModule],
})
export class LoyaltyModule {}
