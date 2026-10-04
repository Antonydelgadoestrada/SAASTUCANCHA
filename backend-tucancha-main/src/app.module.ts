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
import { TransactionsModule } from './transactions/transactions.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('DATABASE_URL');
        const dbHost = config.get<string>('DATABASE_HOST');
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const sslConfig = (config.get<string>('DATABASE_SSL') === 'true' || isProd || !!dbUrl) 
          ? { rejectUnauthorized: false } 
          : false;
        const poolSize = Number(config.get<string>('DATABASE_POOL_SIZE')) || 15;
        const synchronize = config.get<string>('NODE_ENV') !== 'production' && config.get<string>('DATABASE_SYNCHRONIZE') !== 'false';
        
        console.log('--- DEBUG DO APP PLATFORM ---');
        console.log('DATABASE_URL recibido:', dbUrl ? 'Empieza con ' + dbUrl.substring(0, 15) + '...' : 'INDEFINIDO');
        console.log('DATABASE_HOST recibido:', dbHost || 'INDEFINIDO');
        console.log('-----------------------------');

        if (!dbUrl && !dbHost) {
           throw new Error('CRITICAL ERROR: No existe DATABASE_URL ni DATABASE_HOST en las variables de entorno de DigitalOcean.');
        }

        if (dbUrl) {
          // DigitalOcean incluye ?sslmode=require en la URL. 
          // Esto causa que el driver "pg" sobreescriba nuestra configuración y obligue a validar el certificado.
          // Lo removemos para que TypeORM use nuestro objeto sslConfig ({ rejectUnauthorized: false }).
          const cleanUrl = dbUrl.split('?')[0]; 
          return {
            type: 'postgres',
            url: cleanUrl,
            ssl: sslConfig,
            retryAttempts: 20,
            retryDelay: 3000,
            poolSize,
            extra: { 
              max: poolSize,
              ssl: sslConfig
            },
            autoLoadEntities: true,
            synchronize,
          };
        }

        return {
          type: 'postgres',
          host: config.get<string>('DATABASE_HOST'),
          port: Number(config.get<string>('DATABASE_PORT')) || 5432,
          username: config.get<string>('DATABASE_USERNAME'),
          password: config.get<string>('DATABASE_PASSWORD'),
          database: config.get<string>('DATABASE_DATABASE'),
          ssl: sslConfig,
          retryAttempts: 20,
          retryDelay: 3000,
          poolSize,
          extra: { 
            max: poolSize,
            ssl: sslConfig
          },
          autoLoadEntities: true,
          synchronize,
        };
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    UserModule, BookingModule, ClubModule, CourtModule, 
    PaymentModule, ReviewModule, PromotionModule, AuthModule, 
    MailerModule, ScheduleCalendarModule, QrModule,
    MembershipModule,
    TransactionsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
