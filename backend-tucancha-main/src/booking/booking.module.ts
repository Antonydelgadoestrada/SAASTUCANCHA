import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { ScheduleCalendarModule } from '../schedule/schedule.module';
import { CourtModule } from '../court/court.module';
import { MercadoPagoModule } from '../mecado-pago/mercado-pago.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

import { AwsModule } from '../aws/aws.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), 
  ScheduleCalendarModule, CourtModule, MercadoPagoModule, AuthModule, AwsModule, MailerModule,
  UserModule],
  providers: [BookingService],
  controllers: [BookingController],
  exports:[BookingService]
})
export class BookingModule {}
