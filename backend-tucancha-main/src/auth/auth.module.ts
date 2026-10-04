// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { Club } from '../club/club.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '../mailer/mailer.module';
import { GoogleAuthService } from './google-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Club]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'JWT_SECRET_KEY',
        signOptions: { expiresIn: '1d' },
      }),
    }),
    UserModule,
    MailerModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleAuthService, JwtAuthGuard],
  exports:[JwtAuthGuard]
})
export class AuthModule {}
