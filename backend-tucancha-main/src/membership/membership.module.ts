import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from './entities/membership_plan.entity';
import { ClubMembership } from './entities/club_membership.entity';
import { MembershipPayment } from './entities/membership_payment.entity';
import { Club } from '../club/club.entity';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { MembershipCronService } from './membership-cron.service';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MembershipPlan,
      ClubMembership,
      MembershipPayment,
      Club,
    ]),
    MailerModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService, MembershipCronService],
  exports: [MembershipService, MembershipCronService],
})
export class MembershipModule {}
