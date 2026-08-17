import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMonths, addYears, addDays, isAfter } from 'date-fns';
import { MercadoPagoConfig, Preference, Payment as PaymentMp } from 'mercadopago';
import { MembershipPlan } from './entities/membership_plan.entity';
import { ClubMembership } from './entities/club_membership.entity';
import { MembershipPayment } from './entities/membership_payment.entity';
import { MembershipStatus } from './enums/membership-status.enum';
import { BillingInterval } from './enums/billing-interval.enum';
import { MembershipPaymentStatus } from './enums/membership-payment-status.enum';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { Club } from '../club/club.entity';

@Injectable()
export class MembershipService {
  private mercadopago: MercadoPagoConfig;

  constructor(
    @InjectRepository(MembershipPlan)
    private readonly planRepo: Repository<MembershipPlan>,
    @InjectRepository(ClubMembership)
    private readonly membershipRepo: Repository<ClubMembership>,
    @InjectRepository(MembershipPayment)
    private readonly paymentRepo: Repository<MembershipPayment>,
    @InjectRepository(Club)
    private readonly clubRepo: Repository<Club>,
  ) {
    // REGLA DE ORO: Las membresías siempre utilizan las credenciales de la plataforma (Dueño)
    this.mercadopago = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN || '',
    });
  }

  // ----------------------------------------------------
  // PLANES DE MEMBRESÍA (Admin CRUD & Públicos)
  // ----------------------------------------------------
  async createPlan(dto: CreateMembershipPlanDto): Promise<MembershipPlan> {
    const plan = this.planRepo.create(dto);
    return this.planRepo.save(plan);
  }

  async updatePlan(id: string, dto: UpdateMembershipPlanDto): Promise<MembershipPlan> {
    const plan = await this.findPlanById(id);
    Object.assign(plan, dto);
    return this.planRepo.save(plan);
  }

  async findAllPlans(): Promise<MembershipPlan[]> {
    return this.planRepo.find({
      order: { price: 'ASC' },
    });
  }

  async findActivePlans(): Promise<MembershipPlan[]> {
    return this.planRepo.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });
  }

  async findPlanById(id: string): Promise<MembershipPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Plan de membresía con ID ${id} no encontrado`);
    }
    return plan;
  }

  // ----------------------------------------------------
  // GESTIÓN DE MEMBRESÍAS DE CLUB
  // ----------------------------------------------------
  async getClubActiveMembership(clubId: string): Promise<ClubMembership | null> {
    return this.membershipRepo.findOne({
      where: [
        { clubId, status: MembershipStatus.ACTIVE },
        { clubId, status: MembershipStatus.GRACE },
      ],
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });
  }

  async getClubMembershipHistory(clubId: string): Promise<ClubMembership[]> {
    return this.membershipRepo.find({
      where: { clubId },
      relations: ['plan', 'payments'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMembershipPayments(clubId: string): Promise<MembershipPayment[]> {
    return this.paymentRepo.find({
      where: { clubId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Calcula la fecha de finalización según el intervalo del plan
   */
  calculateIntervalEndDate(fromDate: Date, interval: BillingInterval): Date {
    switch (interval) {
      case BillingInterval.ANNUAL:
        return addYears(fromDate, 1);
      case BillingInterval.SEMIANNUAL:
        return addMonths(fromDate, 6);
      case BillingInterval.MONTHLY:
      default:
        return addMonths(fromDate, 1);
    }
  }

  /**
   * Aplica o renueva una membresía para un club respetando las reglas de vigencia:
   * - Si renueva antes de vencer: suma vigencia a la fecha de fin actual.
   * - Si renueva estando vencido/sin membresía: inicia desde hoy.
   */
  async activateOrRenewMembership(
    clubId: string,
    planId: string,
    autoRenew: boolean = true,
  ): Promise<ClubMembership> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException(`Club con ID ${clubId} no encontrado`);
    }

    const plan = await this.findPlanById(planId);
    const now = new Date();

    const currentActive = await this.getClubActiveMembership(clubId);

    let startDate: Date;
    let endDate: Date;

    if (currentActive && isAfter(new Date(currentActive.endDate), now)) {
      // Renovación anticipada: se suma el nuevo tiempo a la fecha de fin actual
      startDate = new Date(currentActive.startDate);
      endDate = this.calculateIntervalEndDate(new Date(currentActive.endDate), plan.interval);
      currentActive.endDate = endDate;
      currentActive.graceEndDate = addDays(endDate, plan.graceDays || 3);
      currentActive.plan = plan;
      currentActive.planId = plan.id;
      currentActive.status = MembershipStatus.ACTIVE;
      currentActive.autoRenew = autoRenew;
      currentActive.cancelAtPeriodEnd = false;
      return this.membershipRepo.save(currentActive);
    } else {
      // Nueva activación o renovación post-vencimiento: cuenta desde hoy
      startDate = now;
      endDate = this.calculateIntervalEndDate(now, plan.interval);
      const graceEndDate = addDays(endDate, plan.graceDays || 3);

      const newMembership = this.membershipRepo.create({
        clubId,
        club,
        planId,
        plan,
        status: MembershipStatus.ACTIVE,
        startDate,
        endDate,
        graceEndDate,
        autoRenew,
        cancelAtPeriodEnd: false,
      });

      return this.membershipRepo.save(newMembership);
    }
  }

  /**
   * Cancelación: no corta el servicio inmediatamente, solo desactiva la renovación
   * manteniendo el estado hasta el endDate.
   */
  async cancelMembershipAutoRenew(clubId: string): Promise<ClubMembership> {
    const membership = await this.getClubActiveMembership(clubId);
    if (!membership) {
      throw new BadRequestException('El club no tiene una membresía activa para cancelar');
    }

    membership.autoRenew = false;
    membership.cancelAtPeriodEnd = true;
    membership.cancelledAt = new Date();

    return this.membershipRepo.save(membership);
  }

  /**
   * Verifica si un club tiene visibilidad pública permitida (APPROVED + ACTIVE o GRACE)
   */
  async isClubPubliclyVisible(clubId: string): Promise<boolean> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club || club.status !== 'APPROVED') {
      return false;
    }

    const membership = await this.getClubActiveMembership(clubId);
    if (!membership) {
      return false;
    }

    return (
      membership.status === MembershipStatus.ACTIVE ||
      membership.status === MembershipStatus.GRACE
    );
  }

  // ----------------------------------------------------
  // SPRINT B: CHECKOUT Y PREFERENCIAS MERCADO PAGO
  // ----------------------------------------------------

  /**
   * Crea una preferencia de pago en Mercado Pago para la membresía del club.
   * El cobro va directamente a la cuenta del dueño de la plataforma.
   */
  async createMembershipPreference(
    clubId: string,
    planId: string,
    autoRenew: boolean = true,
  ): Promise<{ init_point: string; preferenceId: string; paymentId: string }> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException(`Club con ID ${clubId} no encontrado`);
    }

    const plan = await this.findPlanById(planId);
    if (!plan.isActive) {
      throw new BadRequestException('Este plan de membresía no está activo actualmente');
    }

    // 1. Crear registro de pago pendiente
    const payment = this.paymentRepo.create({
      clubId,
      club,
      planId: plan.id,
      plan,
      amount: Number(plan.price),
      currency: plan.currency || 'PEN',
      status: MembershipPaymentStatus.PENDING,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    // 2. Crear la preferencia de Mercado Pago con credenciales de la plataforma
    const preferenceClient = new Preference(this.mercadopago);
    const intervalLabel =
      plan.interval === BillingInterval.ANNUAL
        ? 'Anual'
        : plan.interval === BillingInterval.SEMIANNUAL
        ? 'Semestral'
        : 'Mensual';

    const webUrl = process.env.WEB_SERVICES_URL || 'http://localhost:3000';
    const servicesUrl = process.env.SERVICES_URL || 'http://localhost:3001';

    try {
      const response = await preferenceClient.create({
        body: {
          items: [
            {
              id: plan.id,
              title: `Membresía ${plan.name} (${intervalLabel}) - ${club.name}`,
              description: `Suscripción ${intervalLabel} a la plataforma TuCancha para el club ${club.name}`,
              quantity: 1,
              category_id: 'services',
              currency_id: plan.currency || 'PEN',
              unit_price: Number(plan.price),
            },
          ],
          payer: {
            email: club.email,
          },
          external_reference: `membership_${savedPayment.id}`,
          notification_url: `${servicesUrl}/memberships/webhook`,
          back_urls: {
            success: `${webUrl}/club/membership?payment=success&payment_id=${savedPayment.id}`,
            failure: `${webUrl}/club/membership?payment=failure&payment_id=${savedPayment.id}`,
            pending: `${webUrl}/club/membership?payment=pending&payment_id=${savedPayment.id}`,
          },
        },
      });

      savedPayment.mpPreferenceId = response.id;
      await this.paymentRepo.save(savedPayment);

      return {
        init_point: response.init_point || '',
        preferenceId: response.id || '',
        paymentId: savedPayment.id,
      };
    } catch (error) {
      console.error('Error al crear preferencia de membresía en Mercado Pago:', error);
      throw new BadRequestException(
        `Error al comunicarse con Mercado Pago: ${error?.message || error}`,
      );
    }
  }

  /**
   * Webhook exclusivo e independiente para notificaciones de pago de membresías
   */
  async handleMembershipWebhook(query: any, body?: any): Promise<void> {
    const paymentId = query?.['data.id'] || query?.id || body?.data?.id || body?.id;
    const type = query?.type || body?.type || query?.topic;

    if ((type && type !== 'payment') || !paymentId) {
      return;
    }

    try {
      // 1. Verificación rápida de idempotencia por mpPaymentId existente
      const existingPayment = await this.paymentRepo.findOne({
        where: { mpPaymentId: String(paymentId) },
        relations: ['membership', 'plan'],
      });

      if (existingPayment && existingPayment.status === MembershipPaymentStatus.PAID) {
        console.log(
          `ℹ️ [Webhook Membresía Idempotente] Pago ${paymentId} ya fue procesado como PAID.`,
        );
        return;
      }

      // 2. Consultar detalles de pago a Mercado Pago con token de la plataforma
      const mpPayment = await new PaymentMp(this.mercadopago).get({ id: paymentId });
      const externalRef = mpPayment.external_reference;
      const status = mpPayment.status;

      if (!externalRef || !externalRef.startsWith('membership_')) {
        console.warn(
          `⚠️ [Webhook Membresía] Pago ID ${paymentId} recibido sin external_reference de membresía válido: ${externalRef}`,
        );
        return;
      }

      const paymentRecordId = externalRef.replace('membership_', '');

      // 3. Procesar de forma atómica en transacción
      await this.paymentRepo.manager.transaction(async (trxManager) => {
        let paymentRecord = await trxManager.findOne(MembershipPayment, {
          where: { id: paymentRecordId },
          relations: ['club', 'plan'],
        });

        if (!paymentRecord) {
          console.warn(
            `⚠️ [Webhook Membresía] Registro MembershipPayment no encontrado para ID ${paymentRecordId}`,
          );
          return;
        }

        // Si ya está PAID, abortar
        if (paymentRecord.status === MembershipPaymentStatus.PAID) {
          return;
        }

        let targetStatus = MembershipPaymentStatus.PENDING;
        if (status === 'approved') {
          targetStatus = MembershipPaymentStatus.PAID;
        } else if (status === 'rejected' || status === 'cancelled') {
          targetStatus = MembershipPaymentStatus.REJECTED;
        } else if (status === 'refunded') {
          targetStatus = MembershipPaymentStatus.REFUNDED;
        }

        paymentRecord.status = targetStatus;
        paymentRecord.mpPaymentId = String(mpPayment.id);
        paymentRecord.mpMerchantOrderId = String(mpPayment.order?.id || '');
        paymentRecord.paymentType = mpPayment.payment_type_id || '';
        paymentRecord.paymentMethod = mpPayment.payment_method_id || '';
        paymentRecord.gatewayResponse = mpPayment;

        if (status === 'approved') {
          paymentRecord.paidAt = new Date();
          // Activar / renovar membresía
          const activatedMembership = await this.activateOrRenewMembership(
            paymentRecord.clubId,
            paymentRecord.planId,
            true,
          );
          paymentRecord.membership = activatedMembership;
          paymentRecord.membershipId = activatedMembership.id;
        }

        await trxManager.save(MembershipPayment, paymentRecord);
        console.log(
          `✅ [Webhook Membresía] Pago ${paymentId} procesado exitosamente como ${targetStatus} para club ${paymentRecord.clubId}`,
        );
      });
    } catch (error) {
      console.error(
        `Error al procesar webhook de membresía para ID ${paymentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Consulta el estado de un pago de membresía por ID (para feedback inmediato tras redirect)
   */
  async checkPaymentStatus(paymentId: string, clubId: string): Promise<MembershipPayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, clubId },
      relations: ['plan', 'membership'],
    });
    if (!payment) {
      throw new NotFoundException('Registro de pago no encontrado');
    }
    return payment;
  }
}
