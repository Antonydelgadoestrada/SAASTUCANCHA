import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between, MoreThan } from 'typeorm';
import { addDays, subDays } from 'date-fns';
import { ClubMembership } from './entities/club_membership.entity';
import { Club } from '../club/club.entity';
import { MembershipStatus } from './enums/membership-status.enum';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class MembershipCronService {
  private readonly logger = new Logger(MembershipCronService.name);

  constructor(
    @InjectRepository(ClubMembership)
    private readonly membershipRepo: Repository<ClubMembership>,
    @InjectRepository(Club)
    private readonly clubRepo: Repository<Club>,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Se ejecuta diariamente a las 00:05 AM para evaluar y transicionar
   * los estados de las membresías de los clubes (ACTIVE -> GRACE -> EXPIRED).
   */
  @Cron('0 5 0 * * *')
  async handleMembershipStatusTransitions() {
    this.logger.log('Iniciando verificación programada del estado de membresías...');
    const now = new Date();

    try {
      // ----------------------------------------------------------------------
      // 1. EVALUAR MEMBRESÍAS ACTIVAS CUYO END_DATE YA PASÓ
      // ----------------------------------------------------------------------
      const expiredActiveMemberships = await this.membershipRepo.find({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: LessThan(now),
        },
        relations: ['club', 'plan'],
      });

      for (const membership of expiredActiveMemberships) {
        const clubName = membership.club?.name || 'Club';
        const clubEmail = membership.club?.email;

        // Si tiene periodo de gracia vigente, pasa a GRACE
        if (membership.graceEndDate && new Date(membership.graceEndDate) > now) {
          membership.status = MembershipStatus.GRACE;
          await this.membershipRepo.save(membership);
          this.logger.warn(`Membresía del club ${clubName} (${membership.clubId}) pasó a estado GRACE.`);

          if (clubEmail) {
            try {
              await this.mailerService.sendMembershipEnteredGraceEmail(
                clubEmail,
                clubName,
                new Date(membership.graceEndDate),
              );
            } catch (err) {
              this.logger.error(`Error enviando email de periodo de gracia a ${clubEmail}: ${err.message}`);
            }
          }
        } else {
          // Si no tiene periodo de gracia o ya venció, pasa a EXPIRED
          membership.status = MembershipStatus.EXPIRED;
          await this.membershipRepo.save(membership);
          this.logger.warn(`Membresía del club ${clubName} (${membership.clubId}) pasó a estado EXPIRED.`);

          if (clubEmail) {
            try {
              await this.mailerService.sendMembershipExpiredEmail(clubEmail, clubName);
            } catch (err) {
              this.logger.error(`Error enviando email de expiración a ${clubEmail}: ${err.message}`);
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 2. EVALUAR MEMBRESÍAS EN GRACIA CUYO GRACE_END_DATE YA VENCIÓ
      // ----------------------------------------------------------------------
      const expiredGraceMemberships = await this.membershipRepo.find({
        where: {
          status: MembershipStatus.GRACE,
          graceEndDate: LessThan(now),
        },
        relations: ['club', 'plan'],
      });

      for (const membership of expiredGraceMemberships) {
        const clubName = membership.club?.name || 'Club';
        const clubEmail = membership.club?.email;

        membership.status = MembershipStatus.EXPIRED;
        await this.membershipRepo.save(membership);
        this.logger.warn(`Membresía en gracia del club ${clubName} (${membership.clubId}) expiró definitivamente.`);

        if (clubEmail) {
          try {
            await this.mailerService.sendMembershipExpiredEmail(clubEmail, clubName);
          } catch (err) {
            this.logger.error(`Error enviando email de expiración final a ${clubEmail}: ${err.message}`);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 3. AVISO PREVENTIVO: MEMBRESÍAS ACTIVAS QUE VENCEN EN EXACTAMENTE 3 DÍAS
      // ----------------------------------------------------------------------
      const threeDaysFromNow = addDays(now, 3);
      const startOfTargetDay = new Date(threeDaysFromNow.setHours(0, 0, 0, 0));
      const endOfTargetDay = new Date(threeDaysFromNow.setHours(23, 59, 59, 999));

      const soonExpiringMemberships = await this.membershipRepo.find({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: Between(startOfTargetDay, endOfTargetDay),
        },
        relations: ['club', 'plan'],
      });

      for (const membership of soonExpiringMemberships) {
        const clubName = membership.club?.name || 'Club';
        const clubEmail = membership.club?.email;
        const planName = membership.plan?.name || 'Membresía';

        if (clubEmail) {
          try {
            await this.mailerService.sendMembershipExpiringSoonEmail(
              clubEmail,
              clubName,
              planName,
              3,
              new Date(membership.endDate),
            );
            this.logger.log(`Aviso de vencimiento en 3 días enviado a ${clubName} (${clubEmail}).`);
          } catch (err) {
            this.logger.error(`Error sending prevent notice to ${clubEmail}: ${err.message}`);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 4. EVALUAR EXPIRACIÓN DE PRUEBAS GRATUITAS DE CLUBES (30 DÍAS)
      // ----------------------------------------------------------------------
      this.logger.log('Iniciando verificación programada de expiración de pruebas gratuitas...');
      const approvedClubs = await this.clubRepo.find({
        where: { status: 'APPROVED' },
      });

      for (const club of approvedClubs) {
        if (club.trialEndDate && new Date(club.trialEndDate) < now) {
          // Verificar si tiene alguna membresía de pago activa o en periodo de gracia
          const activeMembership = await this.membershipRepo.findOne({
            where: [
              { clubId: club.id, status: MembershipStatus.ACTIVE },
              { clubId: club.id, status: MembershipStatus.GRACE },
            ],
          });

          if (!activeMembership) {
            club.status = 'SUSPENDED';
            await this.clubRepo.save(club);
            this.logger.warn(`Prueba gratuita del club ${club.name} (${club.id}) expiró. Acceso SUSPENDIDO.`);

            if (club.email) {
              try {
                await (this.mailerService as any).sendTrialExpiredEmail(club.email, club.name);
              } catch (err) {
                this.logger.error(`Error enviando email de expiración de prueba a ${club.email}: ${err.message}`);
              }
            }
          }
        }
      }

      this.logger.log('Verificación programada de membresías completada con éxito.');
    } catch (error) {
      this.logger.error(`Error durante el cron de membresías: ${error?.message || error}`);
    }
  }
}
