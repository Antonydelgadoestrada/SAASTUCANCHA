// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

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

      // Chequeo dinámico de prueba gratuita
      if (user.club.status === 'APPROVED' && user.club.trialEndDate && new Date(user.club.trialEndDate) < new Date()) {
        const activeMembership = await this.dataSource.createQueryBuilder()
          .select('cm')
          .from('club_memberships', 'cm')
          .where('cm.clubId = :clubId', { clubId: user.club.id })
          .andWhere('cm.status IN (:...statuses)', { statuses: ['ACTIVE', 'GRACE'] })
          .getOne();

        if (!activeMembership) {
          user.club.status = 'SUSPENDED';
          await this.dataSource.getRepository('Club').save(user.club);
        }
      }
    }

    return user;
  }
}
