import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { BookingModule } from './booking/booking.module';
import { ClubModule } from './club/club.module';
import { CourtModule } from './court/court.module';
import { PaymentModule } from './payment/payment.module';
import { ReviewModule } from './review/review.module';
import { PromotionModule } from './promotion/promotion.module';
import { AuthModule } from './auth/auth.module';
import { MailerModule } from './mailer/mailer.module';
import { ScheduleCalendarModule } from './schedule/schedule.module';
import { ScheduleModule } from '@nestjs/schedule';
import { QrModule } from './qr/qr.module';
import { MembershipModule } from './membership/membership.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: Number(config.get<string>('DATABASE_PORT')) || 5432,
        username: config.get<string>('DATABASE_USERNAME'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_DATABASE'),
        ssl:
          config.get<string>('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        retryAttempts: 20,
        retryDelay: 3000,
        // Carga entidades desde TypeOrmModule.forFeature() de cada módulo (evita fallos de glob / metadata).
        autoLoadEntities: true,
        synchronize:
          config.get<string>('DATABASE_SYNCHRONIZE') === 'true' ||
          (config.get<string>('NODE_ENV') !== 'production' &&
            config.get<string>('DATABASE_SYNCHRONIZE') !== 'false'),
      }),
    }),
    ScheduleModule.forRoot(),
    UserModule, BookingModule, ClubModule, CourtModule, 
    PaymentModule, ReviewModule, PromotionModule, AuthModule, 
    MailerModule, ScheduleCalendarModule, QrModule,
    MembershipModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
