import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { Club } from '../club/club.entity';
import { ClubMembership } from '../membership/entities/club_membership.entity';
import { MembershipStatus } from '../membership/enums/membership-status.enum';
import { DataSource } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'JWT_SECRET_KEY', // ideal: usar process.env.JWT_SECRET
    });
  }
  
  async validate(payload: { sub: string; email: string }): Promise<User> {
    const user = await this.userService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.club) {
      if (user.club.status === 'PENDING') {
        throw new UnauthorizedException('El administrador debe aceptar el club');
      }

      // Chequeo dinámico de membresía y prueba gratuita
      const membership = await this.dataSource.getRepository(ClubMembership).findOne({
        where: { clubId: user.club.id },
        order: { endDate: 'DESC' },
      });

      const now = new Date();
      let hasActiveMembership = false;

      if (membership) {
        if (new Date(membership.endDate) >= now) {
          hasActiveMembership = true;
          if (membership.status !== MembershipStatus.ACTIVE) {
            membership.status = MembershipStatus.ACTIVE;
            await this.dataSource.getRepository(ClubMembership).save(membership);
          }
        } else if (membership.graceEndDate && new Date(membership.graceEndDate) >= now) {
          hasActiveMembership = true;
          if (membership.status !== MembershipStatus.GRACE) {
            membership.status = MembershipStatus.GRACE;
            await this.dataSource.getRepository(ClubMembership).save(membership);
          }
        } else {
          // Ya venció
          if (membership.status !== MembershipStatus.EXPIRED) {
            membership.status = MembershipStatus.EXPIRED;
            await this.dataSource.getRepository(ClubMembership).save(membership);
          }
        }
      }

      const trialExpired = user.club.trialEndDate ? new Date(user.club.trialEndDate) < now : true;

      if (hasActiveMembership) {
        if (user.club.status === 'SUSPENDED') {
          user.club.status = 'APPROVED';
          await this.dataSource.getRepository(Club).save(user.club);
        }
      } else if (trialExpired) {
        if (user.club.status === 'APPROVED') {
          user.club.status = 'SUSPENDED';
          await this.dataSource.getRepository(Club).save(user.club);
        }
      }
    }

    return user;
  }
}
