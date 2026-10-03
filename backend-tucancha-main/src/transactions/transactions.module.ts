import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubTransaction } from './club-transaction.entity';
import { TransactionsService } from './transactions.service';

import { TransactionsController } from './transactions.controller';
import { Payment } from '../payment/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClubTransaction, Payment])],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
