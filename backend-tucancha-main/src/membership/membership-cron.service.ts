import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between, MoreThan } from 'typeorm';
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';
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
   * los estados de las membresías de los clubes (ACTIVE -> GRACE -> EXPIRED),
   * y enviar recordatorios preventivos de 3 días antes de vencimiento tanto para membresías como para pruebas gratuitas.
   */
  @Cron('0 5 0 * * *')
  async handleMembershipStatusTransitions() {
    this.logger.log('Iniciando verificación programada del estado de membresías y periodos de prueba...');
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
        relations: ['club', 'club.owner', 'plan'],
      });

      for (const membership of expiredActiveMemberships) {
        const clubName = membership.club?.name || 'Club';
        const clubEmails = Array.from(new Set([membership.club?.owner?.email, membership.club?.email].filter(Boolean)));

        // Si tiene periodo de gracia vigente, pasa a GRACE
        if (membership.graceEndDate && new Date(membership.graceEndDate) > now) {
          membership.status = MembershipStatus.GRACE;
          await this.membershipRepo.save(membership);
          this.logger.warn(`Membresía del club ${clubName} (${membership.clubId}) pasó a estado GRACE.`);

          for (const targetEmail of clubEmails) {
            try {
              await this.mailerService.sendMembershipEnteredGraceEmail(
                targetEmail,
                clubName,
                new Date(membership.graceEndDate),
              );
            } catch (err: any) {
              this.logger.error(`Error enviando email de periodo de gracia a ${targetEmail}: ${err.message}`);
            }
          }
        } else {
          // Si no tiene periodo de gracia o ya venció, pasa a EXPIRED
          membership.status = MembershipStatus.EXPIRED;
          await this.membershipRepo.save(membership);
          this.logger.warn(`Membresía del club ${clubName} (${membership.clubId}) pasó a estado EXPIRED.`);

          for (const targetEmail of clubEmails) {
            try {
              await this.mailerService.sendMembershipExpiredEmail(targetEmail, clubName);
            } catch (err: any) {
              this.logger.error(`Error enviando email de expiración a ${targetEmail}: ${err.message}`);
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
        relations: ['club', 'club.owner', 'plan'],
      });

      for (const membership of expiredGraceMemberships) {
        const clubName = membership.club?.name || 'Club';
        const clubEmails = Array.from(new Set([membership.club?.owner?.email, membership.club?.email].filter(Boolean)));

        membership.status = MembershipStatus.EXPIRED;
        await this.membershipRepo.save(membership);
        this.logger.warn(`Membresía en gracia del club ${clubName} (${membership.clubId}) expiró definitivamente.`);

        for (const targetEmail of clubEmails) {
          try {
            await this.mailerService.sendMembershipExpiredEmail(targetEmail, clubName);
          } catch (err: any) {
            this.logger.error(`Error enviando email de expiración final a ${targetEmail}: ${err.message}`);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 3. AVISO PREVENTIVO: MEMBRESÍAS ACTIVAS QUE VENCEN EN EXACTAMENTE 3 DÍAS
      // ----------------------------------------------------------------------
      const threeDaysAhead = addDays(now, 3);
      const startOfTargetDay = startOfDay(threeDaysAhead);
      const endOfTargetDay = endOfDay(threeDaysAhead);

      const soonExpiringMemberships = await this.membershipRepo.find({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: Between(startOfTargetDay, endOfTargetDay),
        },
        relations: ['club', 'club.owner', 'plan'],
      });

      for (const membership of soonExpiringMemberships) {
        const clubName = membership.club?.name || 'Club';
        const ownerName = membership.club?.owner?.name || clubName;
        const clubEmails = Array.from(new Set([membership.club?.owner?.email, membership.club?.email].filter(Boolean)));
        const planName = membership.plan?.name || 'Membresía';

        for (const targetEmail of clubEmails) {
          try {
            await this.mailerService.sendMembershipExpiringSoonEmail(
              targetEmail,
              clubName,
              planName,
              3,
              new Date(membership.endDate),
              ownerName,
            );
            this.logger.log(`Aviso de membresía por vencer en 3 días enviado a ${clubName} (${targetEmail}).`);
          } catch (err: any) {
            this.logger.error(`Error enviando aviso preventivo de membresía a ${targetEmail}: ${err.message}`);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 4. AVISO PREVENTIVO: PRUEBAS GRATUITAS (30 DÍAS) QUE VENCEN EN 3 DÍAS
      // ----------------------------------------------------------------------
      this.logger.log('Verificando pruebas gratuitas que vencen en 3 días...');
      const soonExpiringTrialClubs = await this.clubRepo.find({
        where: {
          status: 'APPROVED',
          trialEndDate: Between(startOfTargetDay, endOfTargetDay),
        },
        relations: ['owner'],
      });

      for (const club of soonExpiringTrialClubs) {
        // Verificar si ya tiene una membresía de pago activa
        const hasPaidMembership = await this.membershipRepo.findOne({
          where: [
            { clubId: club.id, status: MembershipStatus.ACTIVE },
            { clubId: club.id, status: MembershipStatus.GRACE },
          ],
        });

        if (!hasPaidMembership && club.trialEndDate) {
          const clubEmails = Array.from(new Set([club.owner?.email, club.email].filter(Boolean)));
          const ownerName = club.owner?.name || club.name;

          for (const targetEmail of clubEmails) {
            try {
              await this.mailerService.sendTrialExpiringSoonEmail(
                targetEmail,
                club.name,
                3,
                new Date(club.trialEndDate),
                ownerName,
              );
              this.logger.log(`Aviso de prueba gratuita por vencer en 3 días enviado a ${club.name} (${targetEmail}).`);
            } catch (err: any) {
              this.logger.error(`Error enviando aviso preventivo de prueba a ${targetEmail}: ${err.message}`);
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 5. EVALUAR EXPIRACIÓN DE PRUEBAS GRATUITAS DE CLUBES (30 DÍAS) YA PASADAS
      // ----------------------------------------------------------------------
      this.logger.log('Iniciando verificación programada de expiración de pruebas gratuitas...');
      const approvedClubs = await this.clubRepo.find({
        where: { status: 'APPROVED' },
        relations: ['owner'],
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

            const clubEmails = Array.from(new Set([club.owner?.email, club.email].filter(Boolean)));
            for (const targetEmail of clubEmails) {
              try {
                await this.mailerService.sendTrialExpiredEmail(targetEmail, club.name);
              } catch (err: any) {
                this.logger.error(`Error enviando email de expiración de prueba a ${targetEmail}: ${err.message}`);
              }
            }
          }
        }
      }

      this.logger.log('Verificación programada de membresías y pruebas completada con éxito.');
    } catch (error: any) {
      this.logger.error(`Error durante el cron de membresías: ${error?.message || error}`);
    }
  }
}
