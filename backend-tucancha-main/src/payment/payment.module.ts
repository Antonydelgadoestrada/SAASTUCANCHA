import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Booking } from '../booking/booking.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ScheduleCalendarModule } from '../schedule/schedule.module';
import { BookingModule } from '../booking/booking.module';
import { ClubModule } from '../club/club.module';
import { MailerModule } from '../mailer/mailer.module';
import { AwsModule } from '../aws/aws.module';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Booking]),
    ScheduleCalendarModule,
    BookingModule,
    ClubModule,
    MailerModule,
    AwsModule,
    forwardRef(() => MembershipModule),
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
