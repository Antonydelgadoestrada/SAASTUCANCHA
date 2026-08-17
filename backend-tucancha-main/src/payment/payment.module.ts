import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ScheduleCalendarModule } from '../schedule/schedule.module';
import { BookingModule } from '../booking/booking.module';
import { ClubModule } from '../club/club.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), ScheduleCalendarModule, BookingModule, ClubModule, BookingModule, MailerModule],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
