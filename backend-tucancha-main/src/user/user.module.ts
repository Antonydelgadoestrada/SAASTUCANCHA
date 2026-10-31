// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ClubUserController } from './club-user.controller';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), MailerModule],
  providers: [UserService],
  controllers: [UserController, ClubUserController],
  exports: [UserService],
})
export class UserModule {}
