import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from './promotion.entity';
import { PromotionService } from './promotion.service';
import { PromotionController } from './promotion.controller';
import { Court } from '../court/court.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, Court])],
  providers: [PromotionService],
  controllers: [PromotionController],
  exports: [PromotionService],
})
export class PromotionModule {}
