import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingService } from './booking.service';
import { BookingCronService } from './booking-cron.service';
import { BookingController } from './booking.controller';
import { ScheduleCalendarModule } from '../schedule/schedule.module';
import { CourtModule } from '../court/court.module';
import { MercadoPagoModule } from '../mecado-pago/mercado-pago.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { VenueModule } from '../venue/venue.module';
import { AwsModule } from '../aws/aws.module';
import { MailerModule } from '../mailer/mailer.module';
import { Payment } from '../payment/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Payment]), 
    ScheduleCalendarModule, 
    CourtModule, 
    MercadoPagoModule, 
    AuthModule, 
    AwsModule, 
    MailerModule,
    UserModule, 
    VenueModule,
  ],
  providers: [BookingService, BookingCronService],
  controllers: [BookingController],
  exports: [BookingService, BookingCronService],
})
export class BookingModule {}

