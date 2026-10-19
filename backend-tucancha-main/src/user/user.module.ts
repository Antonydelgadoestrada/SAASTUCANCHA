import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Club } from '../club/club.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Club]), MailerModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
