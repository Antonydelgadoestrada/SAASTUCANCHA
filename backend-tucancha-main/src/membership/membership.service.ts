import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMonths, addYears, addDays, addSeconds, addHours, isAfter, isBefore, differenceInDays } from 'date-fns';
import * as crypto from 'crypto';
import axios from 'axios';
import { MercadoPagoConfig, Preference, Payment as PaymentMp, OAuth } from 'mercadopago';
import { MembershipPlan } from './entities/membership_plan.entity';
import { ClubMembership } from './entities/club_membership.entity';
import { MembershipPayment } from './entities/membership_payment.entity';
import { PlatformPaymentConfig } from './entities/platform_payment_config.entity';
import { MembershipStatus } from './enums/membership-status.enum';
import { BillingInterval } from './enums/billing-interval.enum';
import { MembershipPaymentStatus } from './enums/membership-payment-status.enum';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { SubmitManualMembershipPaymentDto } from './dto/submit-manual-membership-payment.dto';
import { SavePlatformCredentialsDto } from './dto/save-platform-credentials.dto';
import { S3Service } from '../aws/s3.service';
import { User } from '../user/user.entity';
import { Club } from '../club/club.entity';
import { TransactionsService } from '../transactions/transactions.service';

export interface MpStatusDetailMapping {
  code: 'APRO' | 'CONT' | 'FUND' | 'SECU' | 'EXPI' | 'FORM' | 'CALL' | 'OTHE';
  label: string;
  description: string;
}

export function mapMpStatusDetail(status?: string, statusDetail?: string): MpStatusDetailMapping {
  if (status === 'approved') {
    return {
      code: 'APRO',
      label: 'Pago Aprobado',
      description: 'El abono fue procesado y acreditado con éxito.',
    };
  }

  if (status === 'in_process' || status === 'pending' || status === 'authorized') {
    return {
      code: 'CONT',
      label: 'Pendiente de Pago',
      description: 'La transacción está en proceso de validación o acreditación bancaria.',
    };
  }

  switch (statusDetail) {
    case 'cc_rejected_insufficient_amount':
      return {
        code: 'FUND',
        label: 'Fondos Insuficientes',
        description: 'Rechazado por saldo insuficiente o límite de crédito alcanzado.',
      };
    case 'cc_rejected_bad_filled_security_code':
      return {
        code: 'SECU',
        label: 'Código de Seguridad Inválido',
        description: 'Rechazado por código de seguridad (CVV) erróneo.',
      };
    case 'cc_rejected_bad_filled_date':
      return {
        code: 'EXPI',
        label: 'Tarjeta Vencida',
        description: 'Rechazado debido a tarjeta vencida o fecha de expiración incorrecta.',
      };
    case 'cc_rejected_bad_filled_card_number':
    case 'cc_rejected_bad_filled_other':
    case 'cc_rejected_invalid_installments':
      return {
        code: 'FORM',
        label: 'Error de Formulario',
        description: 'Rechazado por datos de formulario o número de tarjeta incorrectos.',
      };
    case 'cc_rejected_call_for_authorize':
      return {
        code: 'CALL',
        label: 'Autorización Requerida',
        description: 'El banco emisor requiere que el titular llame para autorizar la compra.',
      };
    default:
      return {
        code: 'OTHE',
        label: 'Rechazo General',
        description: 'Rechazado por error general o bloqueo de seguridad bancaria.',
      };
  }
}

@Injectable()
export class MembershipService implements OnModuleInit {
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
    @InjectRepository(PlatformPaymentConfig)
    private readonly platformPaymentConfigRepo: Repository<PlatformPaymentConfig>,
    private readonly s3Service: S3Service,
    private readonly transactionsService: TransactionsService,
  ) {
    // REGLA DE ORO: Las membresías utilizan las credenciales de la plataforma (Dueño)
    this.mercadopago = new MercadoPagoConfig({
      accessToken: process.env.ADMIN_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
    });
  }

  private getWebUrl(): string {
    let raw = (process.env.WEB_SERVICES_URL || '').trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = process.env.NODE_ENV === 'production' ? 'https://saastucancha.vercel.app' : 'http://localhost:3000';
    }
    return raw.replace(/\/+$/, '');
  }

  private getServicesUrl(): string {
    let raw = (process.env.SERVICES_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
    const domainFlagMatch = raw.match(/--domain=([a-zA-Z0-9.-]+)/);
    if (domainFlagMatch) {
      raw = `https://${domainFlagMatch[1]}`;
    } else if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = process.env.NODE_ENV === 'production' ? 'https://saastucancha.onrender.com' : 'http://localhost:3001';
    }
    return raw.replace(/\/+$/, '');
  }

  async onModuleInit() {
    try {
      // 1. Asegurar que membershipId en membership_payments sea NULLABLE en base de datos
      await this.paymentRepo.query(
        'ALTER TABLE membership_payments ALTER COLUMN "membershipId" DROP NOT NULL;',
      ).catch(() => {});

      // 2. Asegurar que la tabla platform_payment_config exista en entornos donde DATABASE_SYNCHRONIZE=false (Producción)
      await this.platformPaymentConfigRepo.query(`
        CREATE TABLE IF NOT EXISTS platform_payment_config (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "provider" varchar NOT NULL DEFAULT 'mercadopago',
          "mpUserId" varchar,
          "mpAccessToken" text,
          "mpRefreshToken" text,
          "mpPublicKey" varchar,
          "mpTokenExpiresAt" timestamp,
          "isConnected" boolean DEFAULT false,
          "accountEmail" varchar,
          "accountNickname" varchar,
          "environment" varchar DEFAULT 'production',
          "liveMode" boolean DEFAULT true,
          "connectedAt" timestamp,
          "lastSyncAt" timestamp,
          "connectedByUserId" varchar,
          "updatedByUserId" varchar,
          "createdAt" timestamp DEFAULT now(),
          "updatedAt" timestamp DEFAULT now(),
          CONSTRAINT "UQ_platform_payment_config_provider" UNIQUE ("provider")
        );
      `).catch(() => {});
    } catch (e) {
      // Ignorar errores durante inicialización si la BD aún no migró
    }
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
    const plans = await this.planRepo.find({
      order: { price: 'ASC' },
    });
    if (plans.length === 0) {
      return this.findActivePlans();
    }
    return plans;
  }

  async findActivePlans(): Promise<MembershipPlan[]> {
    let plans = await this.planRepo.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });

    if (plans.length === 0) {
      const defaultPlan = this.planRepo.create({
        name: 'Plan Mensual Club',
        description: 'Membresía completa para complejos deportivos y clubes',
        price: 120.00,
        currency: 'PEN',
        interval: BillingInterval.MONTHLY,
        maxCourts: 6,
        features: [
          'Publicación y visibilidad de canchas al público',
          'Gestión de reservas en tiempo real y calendario interactivo',
          'Recepción de pagos automáticos (Mercado Pago)',
          'Recepción de pagos manuales (Yape y Plin con QR)',
          'Contacto directo por WhatsApp con deportistas',
          'Auditoría y control de comprobantes de pago',
          'Soporte técnico prioritario TuCancha',
        ],
        isActive: true,
      });
      await this.planRepo.save(defaultPlan);
      plans = [defaultPlan];
    }

    return plans;
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
    const latest = await this.membershipRepo.findOne({
      where: { clubId },
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });

    if (!latest) {
      return null;
    }

    const now = new Date();
    // Evaluación dinámica y en tiempo real de fechas
    if (new Date(latest.endDate) >= now) {
      if (latest.status !== MembershipStatus.ACTIVE) {
        latest.status = MembershipStatus.ACTIVE;
        await this.membershipRepo.save(latest);
      }
      return latest;
    } else if (latest.graceEndDate && new Date(latest.graceEndDate) >= now) {
      if (latest.status !== MembershipStatus.GRACE) {
        latest.status = MembershipStatus.GRACE;
        await this.membershipRepo.save(latest);
      }
      return latest;
    } else {
      // Expiró
      if (latest.status !== MembershipStatus.EXPIRED) {
        latest.status = MembershipStatus.EXPIRED;
        await this.membershipRepo.save(latest);
        const club = await this.clubRepo.findOne({ where: { id: clubId } });
        if (club && club.status === 'APPROVED') {
          club.status = 'SUSPENDED';
          await this.clubRepo.save(club);
        }
      }
      return latest;
    }
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

    // Garantizar que el club esté en estado APPROVED y reactivado
    if (club.status === 'SUSPENDED') {
      club.status = 'APPROVED';
      await this.clubRepo.save(club);
    }

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
   * Registra un pago manual de membresía (Yape, Plin, Transferencia con comprobante).
   * Al enviar el pago, reactiva inmediatamente la cuenta y membresía del club.
   */
  async submitManualPayment(
    clubId: string,
    dto: SubmitManualMembershipPaymentDto,
    file?: any,
  ): Promise<{ payment: MembershipPayment; membership: ClubMembership | null; message?: string }> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException(`Club con ID ${clubId} no encontrado`);
    }

    const plan = await this.findPlanById(dto.planId);
    if (!plan.isActive) {
      throw new BadRequestException('El plan de membresía seleccionado no está activo');
    }

    let comprobanteUrl: string | undefined = undefined;
    if (file && file.buffer) {
      const sanitized = file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'voucher.png';
      const safeName = `membership_${Date.now()}_${sanitized}`;
      comprobanteUrl = await this.s3Service.uploadFile(
        file.buffer,
        safeName,
        file.mimetype || 'image/png',
        'membership-vouchers',
      );
    }

    // 1. Obtener la membresía actual (si existe) sin activarla aún
    const currentMembership = await this.getClubActiveMembership(clubId);

    // 2. Registrar el pago de membresía en estado PENDING para que el ADMIN lo audite
    const payment = this.paymentRepo.create({
      clubId,
      club,
      membershipId: currentMembership?.id || undefined,
      membership: currentMembership || undefined,
      planId: plan.id,
      plan,
      amount: Number(plan.price),
      currency: plan.currency || 'PEN',
      paymentMethod: dto.paymentMethod || 'MANUAL',
      paymentType: 'MANUAL',
      comprobanteUrl,
      referenceNumber: dto.referenceNumber,
      notes: dto.notes,
      status: MembershipPaymentStatus.PENDING,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    return {
      payment: savedPayment,
      membership: currentMembership,
      message: 'Comprobante registrado exitosamente. Tu membresía se activará una vez validada por un administrador.',
    };
  }

  /**
   * ADMIN: Aprobar comprobante manual de membresía y activar / renovar la membresía.
   */
  async approveManualPayment(paymentId: string, auditor: User) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['club', 'plan'],
    });
    if (!payment) throw new NotFoundException('Pago de membresía no encontrado');
    if (payment.status === MembershipPaymentStatus.PAID) {
      throw new BadRequestException('El pago ya fue aprobado previamente');
    }

    // Activar o renovar membresía
    const activatedMembership = await this.activateOrRenewMembership(
      payment.clubId,
      payment.planId,
      true,
    );

    payment.status = MembershipPaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.membershipId = activatedMembership.id;
    payment.membership = activatedMembership;
    const saved = await this.paymentRepo.save(payment);

    return {
      message: 'Pago de membresía aprobado y membresía activada exitosamente',
      payment: saved,
      membership: activatedMembership,
    };
  }

  /**
   * ADMIN: Rechazar comprobante manual de membresía.
   */
  async rejectManualPayment(paymentId: string, auditor: User, motivo?: string) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago de membresía no encontrado');

    payment.status = MembershipPaymentStatus.REJECTED;
    if (motivo) {
      payment.notes = payment.notes ? `${payment.notes} | Motivo rechazo: ${motivo}` : `Motivo rechazo: ${motivo}`;
    }
    const saved = await this.paymentRepo.save(payment);
    return {
      message: 'Pago de membresía rechazado',
      payment: saved,
    };
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
   * Aplica reglas estrictas de Sandbox para Perú (Checkout Pro).
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

    const currentActive = await this.getClubActiveMembership(clubId);

    // 1. Crear registro de pago pendiente
    const payment = this.paymentRepo.create({
      clubId,
      club,
      membershipId: currentActive?.id || undefined,
      membership: currentActive || undefined,
      planId: plan.id,
      plan,
      amount: Number(plan.price),
      currency: plan.currency || 'PEN',
      status: MembershipPaymentStatus.PENDING,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    // 4. Inicializar SDK leyendo Access Token desde BD o fallback (usar misma config que webhook)
    const { accessToken, client: mpConfigClient } = await this.getActivePlatformMercadoPagoConfig();

    if (!accessToken) {
      throw new BadRequestException(
        'Falta configurar ADMIN_ACCESS_TOKEN o conectar la cuenta Admin vía OAuth en el Dashboard.',
      );
    }

    const preferenceClient = new Preference(mpConfigClient);

    const isSandbox =
      accessToken.startsWith('TEST-') ||
      process.env.MP_SANDBOX === 'true' ||
      process.env.NODE_ENV !== 'production';

    const intervalLabel =
      plan.interval === BillingInterval.ANNUAL
        ? 'Anual'
        : plan.interval === BillingInterval.SEMIANNUAL
        ? 'Semestral'
        : 'Mensual';

    const webUrl = this.getWebUrl();
    const servicesUrl = this.getServicesUrl();

    // 1. Nodo payer obligatorio con email de prueba válido
    // En Sandbox de Mercado Pago, el pagador nunca puede ser el mismo usuario vendedor
    const testPayerEmail =
      process.env.MP_TEST_PAYER_EMAIL ||
      (club.email && club.email.includes('testuser.com') ? club.email : 'test_user_123@testuser.com');

    const payerEmail = isSandbox ? testPayerEmail : (club.email || testPayerEmail);

    // 2. Items con unit_price y quantity estrictamente como números
    const unitPriceNumber = Number(Number(plan.price).toFixed(2));
    const quantityNumber = 1;

    // 3. Nodo back_urls con success, failure y pending, y auto_return: "approved"
    const backUrls = {
      success: `${webUrl}/club/membership?payment=success&payment_id=${savedPayment.id}`,
      failure: `${webUrl}/club/membership?payment=failure&payment_id=${savedPayment.id}`,
      pending: `${webUrl}/club/membership?payment=pending&payment_id=${savedPayment.id}`,
    };

    try {
      const response = await preferenceClient.create({
        body: {
          items: [
            {
              id: String(plan.id),
              title: `Membresía ${plan.name} (${intervalLabel}) - ${club.name}`,
              description: `Suscripción ${intervalLabel} a la plataforma TuCancha para el club ${club.name}`,
              quantity: quantityNumber,
              category_id: 'services',
              currency_id: plan.currency || 'PEN',
              unit_price: unitPriceNumber,
            },
          ],
          payer: {
            email: payerEmail,
            name: club.name || 'Usuario Club',
          },
          metadata: {
            email: club.email,
            clubId: club.id,
            paymentId: savedPayment.id,
          },
          external_reference: `membership_${savedPayment.id}`,
          notification_url: `${servicesUrl}/memberships/webhook`,
          back_urls: backUrls,
          auto_return: 'approved',
        },
      });

      savedPayment.mpPreferenceId = response.id;
      await this.paymentRepo.save(savedPayment);

      const finalInitPoint =
        (isSandbox && response.sandbox_init_point)
          ? response.sandbox_init_point
          : (response.init_point || response.sandbox_init_point || '');

      return {
        init_point: finalInitPoint,
        preferenceId: response.id || '',
        paymentId: savedPayment.id,
      };
    } catch (error: any) {
      console.error('Error al crear preferencia de membresía en Mercado Pago:', error?.response?.data || error?.message || error);
      throw new BadRequestException(
        `Error al comunicarse con Mercado Pago: ${error?.response?.data?.message || error?.message || error}`,
      );
    }
  }

  /**
   * Valida la firma criptográfica HMAC-SHA256 enviada por Mercado Pago en el webhook (SEC-012).
   * Documentación oficial Mercado Pago:
   * Header x-signature: ts=...,v1=...
   * Header x-request-id: uuid
   * Manifest canónico: id:[data.id];request-id:[x-request-id];ts:[ts];
   * Manifest alternativo: id:[data.id];ts:[ts];
   */
  public verifyWebhookSignature(
    dataId: string,
    headers: Record<string, string> = {},
    secretKey?: string,
  ): { valid: boolean; reason?: string } {
    const rawSecret = secretKey || process.env.MP_WEBHOOK_SECRET;

    if (!rawSecret || !rawSecret.trim()) {
      return {
        valid: true,
        reason: 'MP_WEBHOOK_SECRET no configurado - omitiendo validación HMAC (Modo Contingencia / Fallback a API)',
      };
    }

    const secrets = rawSecret.split(',').map((s) => s.trim()).filter(Boolean);

    const xSignature =
      headers['x-signature'] ||
      headers['X-Signature'] ||
      headers['x_signature'];
    const xRequestId =
      headers['x-request-id'] ||
      headers['X-Request-Id'] ||
      headers['x_request_id'];

    if (!xSignature) {
      return {
        valid: false,
        reason: 'Falta cabecera x-signature',
      };
    }

    try {
      // 1. Extraer ts y v1 de la cabecera x-signature (ej: "ts=1704067200,v1=hash...")
      const parts: Record<string, string> = {};
      xSignature.split(',').forEach((part) => {
        const [k, v] = part.trim().split('=');
        if (k && v) parts[k.trim()] = v.trim();
      });

      const ts = parts['ts'];
      const v1 = parts['v1'];

      if (!ts || !v1) {
        return {
          valid: false,
          reason: 'Cabecera x-signature con formato inválido (falta ts o v1)',
        };
      }

      // 2. Construir los templates según especificación oficial de Mercado Pago
      const manifestsToTest: string[] = [];
      if (xRequestId) {
        manifestsToTest.push(`id:${dataId};request-id:${xRequestId};ts:${ts};`);
      }
      manifestsToTest.push(`id:${dataId};ts:${ts};`);

      const v1Buffer = Buffer.from(v1.toLowerCase());

      for (const secret of secrets) {
        for (const manifest of manifestsToTest) {
          const computedHash = crypto
            .createHmac('sha256', secret)
            .update(manifest)
            .digest('hex');
          const computedBuffer = Buffer.from(computedHash.toLowerCase());

          if (
            computedBuffer.length === v1Buffer.length &&
            crypto.timingSafeEqual(computedBuffer, v1Buffer)
          ) {
            return { valid: true };
          }
        }
      }

      return {
        valid: false,
        reason: 'Firma HMAC SHA256 no coincide con el secreto configurado',
      };
    } catch (err: any) {
      return {
        valid: false,
        reason: `Error al procesar la firma criptográfica: ${err.message}`,
      };
    }
  }

  /**
   * Webhook exclusivo e independiente para notificaciones de pago de membresías
   */
  async handleMembershipWebhook(query: any, body?: any, headers: Record<string, string> = {}): Promise<void> {
    const paymentId = query?.['data.id'] || query?.id || body?.data?.id || body?.id;
    const type = query?.type || body?.type || query?.topic;

    if ((type && type !== 'payment') || !paymentId) {
      return;
    }

    // 0. Validación de Firma Criptográfica HMAC-SHA256 (SEC-012)
    const verification = this.verifyWebhookSignature(String(paymentId), headers);
    if (!verification.valid) {
      if (verification.reason === 'Falta cabecera x-signature') {
        // Modo Contingencia: Notificación legacy / IPN o ping de prueba sin cabecera
        console.warn(`⚠️ [Webhook Membresía] Notificación recibida sin cabecera x-signature para pago ${paymentId}. Continuando con verificación de servidor a servidor (Tier 2 API)...`);
      } else {
        // Intento de spoofing, firma adulterada o secreto incorrecto
        console.error(`🚨 [Webhook Membresía] Intento de firma inválida o adulterada para pago ${paymentId}: ${verification.reason}`);
        throw new UnauthorizedException(`Firma HMAC de webhook inválida: ${verification.reason}`);
      }
    } else if (verification.reason) {
      // Modo Contingencia: MP_WEBHOOK_SECRET no configurado
      console.warn(`⚠️ [Webhook Membresía] ${verification.reason}`);
    } else {
      console.log(`✅ [Webhook Membresía] Firma HMAC-SHA256 validada con éxito para pago ${paymentId}`);
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

      // 2. Consultar detalles de pago a Mercado Pago con token activo de la plataforma
      const { client: mpConfigClient } = await this.getActivePlatformMercadoPagoConfig();
      const mpPayment = await new PaymentMp(mpConfigClient).get({ id: paymentId });
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

        const mappedDetail = mapMpStatusDetail(status, mpPayment.status_detail);

        paymentRecord.status = targetStatus;
        paymentRecord.mpPaymentId = String(mpPayment.id);
        paymentRecord.mpMerchantOrderId = String(mpPayment.order?.id || '');
        paymentRecord.paymentType = mpPayment.payment_type_id || '';
        paymentRecord.paymentMethod = mpPayment.payment_method_id || '';
        paymentRecord.gatewayResponse = mpPayment;
        paymentRecord.notes = `[${mappedDetail.code}] ${mappedDetail.label}: ${mappedDetail.description}`;

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
        
        if (status === 'approved') {
          this.transactionsService.recordFromMembershipPayment(paymentRecord).catch(() => {});
        }
        
        console.log(
          `✅ [Webhook Membresía] Pago ${paymentId} procesado exitosamente como ${targetStatus} [${mappedDetail.code}] para club ${paymentRecord.clubId}`,
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

  // ----------------------------------------------------
  // GESTIÓN ADMIN: CLIENTES Y MEMBRESÍAS
  // ----------------------------------------------------
  async getAdminClients(
    search?: string,
    filter?: string,
  ): Promise<{
    clients: any[];
    stats: {
      totalClubs: number;
      activeMemberships: number;
      expiringSoon: number;
      gracePeriod: number;
      expired: number;
      mrr: number;
    };
  }> {
    // Buscar todos los clubes
    const query = this.clubRepo
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.owner', 'owner')
      .orderBy('club.createdAt', 'DESC');

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(club.name) LIKE :term OR LOWER(club.email) LIKE :term OR LOWER(club.district) LIKE :term OR LOWER(club.phone) LIKE :term)',
        { term },
      );
    }

    const clubs = await query.getMany();
    const now = new Date();

    // Obtener la membresía más reciente de cada club
    const allMemberships = await this.membershipRepo.find({
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });

    const membershipsByClub = new Map<string, ClubMembership>();
    for (const m of allMemberships) {
      if (!membershipsByClub.has(m.clubId)) {
        membershipsByClub.set(m.clubId, m);
      }
    }

    let activeMembershipsCount = 0;
    let expiringSoonCount = 0;
    let gracePeriodCount = 0;
    let expiredCount = 0;
    let totalMrr = 0;

    const clients = clubs.map((club) => {
      const latestMembership = membershipsByClub.get(club.id);
      let membershipInfo: any = null;
      let effectiveStatus = 'NONE';
      let isExpiringSoon = false;
      let daysRemaining = 0;

      if (latestMembership) {
        const endDate = new Date(latestMembership.endDate);
        const graceEndDate = latestMembership.graceEndDate
          ? new Date(latestMembership.graceEndDate)
          : null;
        const diffMs = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (endDate >= now) {
          effectiveStatus = MembershipStatus.ACTIVE;
          if (daysRemaining <= 7) {
            isExpiringSoon = true;
            expiringSoonCount++;
          }
          activeMembershipsCount++;

          if (latestMembership.plan) {
            const price = Number(latestMembership.plan.price) || 0;
            if (latestMembership.plan.interval === BillingInterval.ANNUAL) {
              totalMrr += price / 12;
            } else if (latestMembership.plan.interval === BillingInterval.SEMIANNUAL) {
              totalMrr += price / 6;
            } else {
              totalMrr += price;
            }
          }
        } else if (graceEndDate && graceEndDate >= now) {
          effectiveStatus = MembershipStatus.GRACE;
          gracePeriodCount++;
          isExpiringSoon = true;
        } else {
          effectiveStatus = MembershipStatus.EXPIRED;
          expiredCount++;
        }

        membershipInfo = {
          id: latestMembership.id,
          planId: latestMembership.planId,
          planName: latestMembership.plan?.name || 'Plan Club',
          interval: latestMembership.plan?.interval || 'MONTHLY',
          price: Number(latestMembership.plan?.price || 0),
          currency: latestMembership.plan?.currency || 'PEN',
          startDate: latestMembership.startDate,
          endDate: latestMembership.endDate,
          graceEndDate: latestMembership.graceEndDate,
          status: effectiveStatus,
          originalStatus: latestMembership.status,
          autoRenew: latestMembership.autoRenew,
          cancelAtPeriodEnd: latestMembership.cancelAtPeriodEnd,
          isExpiringSoon,
          daysRemaining,
        };
      } else {
        expiredCount++;
      }

      const isTrialActive = Boolean(
        club.trialEndDate && new Date(club.trialEndDate) > now && club.status === 'APPROVED',
      );

      return {
        id: club.id,
        name: club.name,
        email: club.email,
        phone: club.phone,
        whatsapp: (club as any).whatsapp || club.phone,
        address: club.address,
        district: club.district || 'No especificado',
        logo: club.logo,
        status: club.status,
        createdAt: club.createdAt,
        owner: club.owner
          ? {
              id: club.owner.id,
              name: club.owner.name,
              email: club.owner.email,
              phone: club.owner.phone,
            }
          : null,
        membership: membershipInfo,
        effectiveStatus,
        isExpiringSoon,
        isTrialActive,
        trialEndDate: club.trialEndDate,
      };
    });

    let filteredClients = clients;
    if (filter === 'ACTIVE') {
      filteredClients = clients.filter((c) => c.effectiveStatus === 'ACTIVE');
    } else if (filter === 'EXPIRING') {
      filteredClients = clients.filter((c) => c.isExpiringSoon && c.effectiveStatus !== 'EXPIRED');
    } else if (filter === 'GRACE') {
      filteredClients = clients.filter((c) => c.effectiveStatus === 'GRACE');
    } else if (filter === 'EXPIRED') {
      filteredClients = clients.filter(
        (c) => c.effectiveStatus === 'EXPIRED' || c.effectiveStatus === 'NONE',
      );
    }

    return {
      clients: filteredClients,
      stats: {
        totalClubs: clubs.length,
        activeMemberships: activeMembershipsCount,
        expiringSoon: expiringSoonCount,
        gracePeriod: gracePeriodCount,
        expired: expiredCount,
        mrr: Math.round(totalMrr * 100) / 100,
      },
    };
  }

  // ----------------------------------------------------
  // GESTIÓN ADMIN: TRANSACCIONES DE MEMBRESÍAS (MERCADO PAGO)
  // ----------------------------------------------------
  async getAdminMembershipPayments(
    search?: string,
    status?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    payments: any[];
    summary: {
      totalPaidAmount: number;
      monthPaidAmount: number;
      totalTransactions: number;
      paidCount: number;
      pendingCount: number;
      rejectedCount: number;
      refundedCount: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const allPayments = await this.paymentRepo.find({
      relations: ['plan', 'club'],
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let totalPaidAmount = 0;
    let monthPaidAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let refundedCount = 0;

    for (const p of allPayments) {
      const amt = Number(p.amount) || 0;
      if (p.status === MembershipPaymentStatus.PAID) {
        totalPaidAmount += amt;
        paidCount++;
        const pDate = p.paidAt ? new Date(p.paidAt) : new Date(p.createdAt);
        if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
          monthPaidAmount += amt;
        }
      } else if (p.status === MembershipPaymentStatus.PENDING) {
        pendingCount++;
      } else if (p.status === MembershipPaymentStatus.REJECTED) {
        rejectedCount++;
      } else if (p.status === MembershipPaymentStatus.REFUNDED) {
        refundedCount++;
      }
    }

    const query = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.club', 'club')
      .leftJoinAndSelect('p.plan', 'plan')
      .leftJoinAndSelect('p.membership', 'membership')
      .orderBy('p.createdAt', 'DESC');

    if (status && status !== 'ALL') {
      query.andWhere('p.status = :status', { status });
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(club.name) LIKE :term OR LOWER(club.email) LIKE :term OR LOWER(p.mpPaymentId) LIKE :term OR LOWER(p.referenceNumber) LIKE :term OR LOWER(p.id) LIKE :term)',
        { term },
      );
    }

    const totalCount = await query.getCount();
    const skip = (page - 1) * limit;
    const paginatedPayments = await query.skip(skip).take(limit).getMany();

    const formattedPayments = paginatedPayments.map((p) => {
      const gwStatus =
        p.gatewayResponse?.status ||
        (p.status === MembershipPaymentStatus.PAID
          ? 'approved'
          : p.status === MembershipPaymentStatus.REJECTED
          ? 'rejected'
          : 'pending');
      const gwDetail = p.gatewayResponse?.status_detail;
      const mapped = mapMpStatusDetail(gwStatus, gwDetail);

      return {
        id: p.id,
        clubId: p.clubId,
        clubName: p.club?.name || 'Club desconocido',
        clubEmail: p.club?.email || '',
        clubLogo: p.club?.logo || null,
        clubDistrict: p.club?.district || null,
        planId: p.planId,
        planName: p.plan?.name || 'Plan de Membresía',
        interval: p.plan?.interval || 'MONTHLY',
        amount: Number(p.amount),
        currency: p.currency || 'PEN',
        status: p.status,
        statusCode: mapped.code,
        statusLabel: mapped.label,
        statusDescription: mapped.description,
        statusDetail: gwDetail || null,
        mpPaymentId: p.mpPaymentId || null,
        mpPreferenceId: p.mpPreferenceId || null,
        mpMerchantOrderId: p.mpMerchantOrderId || null,
        paymentMethod: p.paymentMethod || 'mercadopago',
        paymentType: p.paymentType || 'automatic',
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        comprobanteUrl: p.comprobanteUrl,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        gatewayResponse: p.gatewayResponse,
      };
    });

    return {
      payments: formattedPayments,
      summary: {
        totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
        monthPaidAmount: Math.round(monthPaidAmount * 100) / 100,
        totalTransactions: allPayments.length,
        paidCount,
        pendingCount,
        rejectedCount,
        refundedCount,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  // ----------------------------------------------------
  // CONEXIÓN MERCADO PAGO PLATAFORMA (SUPER ADMIN)
  // ----------------------------------------------------

  private getOAuthSecret(): string {
    return process.env.JWT_SECRET || 'tucancha_platform_mp_secure_key_2026';
  }

  /**
   * Genera un estado OAuth anti-CSRF firmado con HMAC-SHA256 y expiración en 15 minutos.
   */
  generateAdminOAuthState(adminUserId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const payload = `admin_platform:${adminUserId}:${nonce}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.getOAuthSecret())
      .update(payload)
      .digest('hex');
    return `${payload}:${signature}`;
  }

  /**
   * Valida la firma criptográfica anti-CSRF y la ventana de tiempo del estado OAuth.
   */
  verifyAdminOAuthState(state: string): { valid: boolean; adminUserId?: string; reason?: string } {
    if (!state || !state.startsWith('admin_platform:')) {
      return { valid: false, reason: 'Prefijo no corresponde a plataforma admin' };
    }
    const parts = state.split(':');
    if (parts.length !== 5) {
      return { valid: false, reason: 'Formato de estado OAuth inválido' };
    }
    const [prefix, adminUserId, nonce, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > 15 * 60 * 1000) {
      return { valid: false, reason: 'Estado OAuth expirado (límite 15 minutos)' };
    }
    const payload = `${prefix}:${adminUserId}:${nonce}:${timestampStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.getOAuthSecret())
      .update(payload)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, reason: 'Firma HMAC anti-CSRF no coincide' };
      }
    } catch {
      return { valid: false, reason: 'Error verificando firma criptográfica' };
    }

    return { valid: true, adminUserId };
  }

  /**
   * Retorna la configuración activa de Mercado Pago de la plataforma.
   * Si existe en la BD y está conectado, renueva el token automáticamente si expira en < 2 horas.
   * Si no está en BD, utiliza fallback a process.env.MP_ACCESS_TOKEN.
   */
  async getActivePlatformMercadoPagoConfig(): Promise<{
    accessToken: string;
    client: MercadoPagoConfig;
    source: 'database' | 'environment';
    configEntity?: PlatformPaymentConfig;
  }> {
    const config = await this.platformPaymentConfigRepo
      .createQueryBuilder('cfg')
      .addSelect(['cfg.mpAccessToken', 'cfg.mpRefreshToken'])
      .where('cfg.provider = :provider AND cfg.isConnected = :isConnected', {
        provider: 'mercadopago',
        isConnected: true,
      })
      .getOne();

    if (config && config.mpAccessToken) {
      // Auto-renovación si quedan menos de 2 horas y existe refresh token
      if (
        config.mpRefreshToken &&
        config.mpTokenExpiresAt &&
        isBefore(new Date(config.mpTokenExpiresAt), addHours(new Date(), 2))
      ) {
        try {
          const oauth = new OAuth(this.mercadopago);
          const refreshed = await oauth.refresh({
            body: {
              client_id: process.env.MP_CLIENT_ID || '',
              client_secret: process.env.MP_CLIENT_SECRET || '',
              refresh_token: config.mpRefreshToken,
            },
          });
          config.mpAccessToken = refreshed.access_token;
          if (refreshed.refresh_token) {
            config.mpRefreshToken = refreshed.refresh_token;
          }
          if (refreshed.public_key) {
            config.mpPublicKey = refreshed.public_key;
          }
          config.mpTokenExpiresAt = addSeconds(new Date(), refreshed.expires_in || 15552000);
          config.lastSyncAt = new Date();
          await this.platformPaymentConfigRepo.save(config);
          console.log('🔄 [Platform MP] Token renovado proactivamente');
        } catch (err: any) {
          console.error('⚠️ [Platform MP] Error en auto-renovación de token:', err?.message || err);
        }
      }

      return {
        accessToken: config.mpAccessToken,
        client: new MercadoPagoConfig({ accessToken: config.mpAccessToken }),
        source: 'database',
        configEntity: config,
      };
    }

    const envToken = process.env.ADMIN_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
    return {
      accessToken: envToken,
      client: this.mercadopago,
      source: 'environment',
    };
  }

  /**
   * Obtiene el estado público de Mercado Pago para el panel Admin (Zero-Leakage).
   * Jamás retorna mpAccessToken ni mpRefreshToken.
   */
  async getPlatformMercadoPagoStatus() {
    const config = await this.platformPaymentConfigRepo.findOne({
      where: { provider: 'mercadopago' },
    });

    const hasEnvFallback = Boolean(process.env.MP_ACCESS_TOKEN);
    const hasClientIdAndSecret = Boolean(
      process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET,
    );

    let expiresInDays: number | null = null;
    if (config?.mpTokenExpiresAt) {
      expiresInDays = Math.max(0, differenceInDays(new Date(config.mpTokenExpiresAt), new Date()));
    }

    const isConnected = Boolean(config?.isConnected);

    // Enmascarar User ID (ej: "12345678" -> "1234****")
    let maskedUserId: string | null = null;
    if (config?.mpUserId) {
      maskedUserId =
        config.mpUserId.length > 4
          ? `${config.mpUserId.slice(0, 4)}****`
          : config.mpUserId;
    }

    return {
      isConnected,
      provider: 'mercadopago',
      mpUserId: maskedUserId,
      mpPublicKey: config?.mpPublicKey || null,
      accountEmail: config?.accountEmail || null,
      accountNickname: config?.accountNickname || null,
      environment: config?.environment || 'sandbox',
      connectedAt: config?.connectedAt || null,
      lastSyncAt: config?.lastSyncAt || null,
      mpTokenExpiresAt: config?.mpTokenExpiresAt || null,
      expiresInDays,
      source: isConnected ? 'database' : hasEnvFallback ? 'environment' : 'unconfigured',
      hasEnvFallback,
      hasClientIdAndSecret,
      redirectUri: `${this.getServicesUrl()}/payments/oauth/callback`,
    };
  }

  /**
   * Genera el URL oficial de OAuth Mercado Pago para conectar la cuenta Admin
   */
  async getAdminAuthorizeUrl(adminUserId: string): Promise<string> {
    const clientId = process.env.MP_CLIENT_ID;
    const servicesUrl = this.getServicesUrl();

    if (!clientId) {
      throw new BadRequestException(
        'Falta configurar MP_CLIENT_ID en las variables de entorno de la plataforma',
      );
    }

    const signedState = this.generateAdminOAuthState(adminUserId);
    const oauth = new OAuth(this.mercadopago);

    const url = oauth.getAuthorizationURL({
      options: {
        client_id: clientId,
        redirect_uri: `${servicesUrl}/payments/oauth/callback`,
        state: signedState,
      },
    });

    return url;
  }

  /**
   * Procesa el retorno de OAuth de Mercado Pago para la cuenta de plataforma
   */
  async handlePlatformOauthCallback(
    code: string,
    state: string,
  ): Promise<{ redirect: string }> {
    const webUrl = this.getWebUrl();
    const servicesUrl = this.getServicesUrl();


    // 1. Validar Anti-CSRF
    const verification = this.verifyAdminOAuthState(state);
    if (!verification.valid) {
      console.error('⛔ [Platform MP OAuth] CSRF State Invalido:', verification.reason);
      return {
        redirect: `${webUrl}/admin/mercadopago?error=csrf_validation_failed&reason=${encodeURIComponent(
          verification.reason || 'invalid_state',
        )}`,
      };
    }

    // 2. Canjear código por tokens con Mercado Pago
    try {
      const oauth = new OAuth(this.mercadopago);
      const credentials = await oauth.create({
        body: {
          client_id: process.env.MP_CLIENT_ID || '',
          client_secret: process.env.MP_CLIENT_SECRET || '',
          code,
          redirect_uri: `${servicesUrl}/payments/oauth/callback`,
        },
      });

      const { access_token, refresh_token, user_id, public_key, live_mode } = credentials;

      // 3. Consultar datos de la cuenta en MP (/users/me)
      let accountEmail: string | null = null;
      let accountNickname: string | null = null;
      try {
        const meRes = await axios.get('https://api.mercadopago.com/users/me', {
          headers: { Authorization: `Bearer ${access_token}` },
          timeout: 5000,
        });
        accountEmail = meRes.data?.email || null;
        accountNickname = meRes.data?.nickname || meRes.data?.first_name || null;
      } catch (err: any) {
        console.warn('⚠️ [Platform MP] No se pudo obtener /users/me de Mercado Pago:', err?.message || err);
      }

      // 4. Persistir configuración de forma segura
      let config = await this.platformPaymentConfigRepo.findOne({
        where: { provider: 'mercadopago' },
      });

      if (!config) {
        config = this.platformPaymentConfigRepo.create({ provider: 'mercadopago' });
      }

      config.mpUserId = String(user_id);
      config.mpAccessToken = access_token;
      config.mpRefreshToken = refresh_token || null;
      config.mpPublicKey = public_key || null;
      config.mpTokenExpiresAt = addSeconds(new Date(), credentials.expires_in || 15552000);
      config.isConnected = true;
      config.accountEmail = accountEmail;
      config.accountNickname = accountNickname;
      config.environment = live_mode ? 'production' : 'sandbox';
      config.connectedAt = new Date();
      config.lastSyncAt = new Date();
      config.updatedByUserId = verification.adminUserId || null;

      await this.platformPaymentConfigRepo.save(config);

      console.log(
        `✅ [Platform MP OAuth] Mercado Pago de la plataforma conectado exitosamente para User MP ${user_id}`,
      );

      return {
        redirect: `${webUrl}/admin/mercadopago?status=connected`,
      };
    } catch (err: any) {
      const errorDetail =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'oauth_exchange_failed';
      console.error('⛔ [Platform MP OAuth Error]:', err?.response?.data || err?.message || err);
      return {
        redirect: `${webUrl}/admin/mercadopago?error=oauth_exchange_failed&reason=${encodeURIComponent(
          String(errorDetail),
        )}`,
      };
    }
  }

  /**
   * Desconecta la cuenta de Mercado Pago de la plataforma
   */
  async disconnectPlatformMercadoPago(adminUserId?: string) {
    const config = await this.platformPaymentConfigRepo.findOne({
      where: { provider: 'mercadopago' },
    });

    if (!config) {
      throw new NotFoundException('No existe configuración de Mercado Pago para desconectar');
    }

    config.isConnected = false;
    config.mpAccessToken = null;
    config.mpRefreshToken = null;
    config.lastSyncAt = new Date();
    if (adminUserId) {
      config.updatedByUserId = adminUserId;
    }

    await this.platformPaymentConfigRepo.save(config);

    return {
      success: true,
      message: 'Cuenta de Mercado Pago desconectada exitosamente',
    };
  }

  /**
   * Prueba de conectividad activa (Ping) con los servidores de Mercado Pago
   */
  async syncPlatformMercadoPago() {
    const active = await this.getActivePlatformMercadoPagoConfig();
    if (!active.accessToken) {
      throw new BadRequestException('No hay ninguna credencial de Mercado Pago configurada');
    }

    const startTime = Date.now();
    try {
      const response = await axios.get('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${active.accessToken}` },
        timeout: 7000,
      });
      const latencyMs = Date.now() - startTime;

      // Actualizar lastSyncAt si existe en BD
      if (active.configEntity) {
        active.configEntity.lastSyncAt = new Date();
        if (response.data?.email) {
          active.configEntity.accountEmail = response.data.email;
        }
        if (response.data?.nickname) {
          active.configEntity.accountNickname = response.data.nickname;
        }
        await this.platformPaymentConfigRepo.save(active.configEntity);
      }

      return {
        success: true,
        latencyMs,
        source: active.source,
        accountEmail: response.data?.email || null,
        accountNickname: response.data?.nickname || null,
        countryId: response.data?.country_id || 'PE',
        liveMode: response.data?.site_status === 'active',
        message: 'Conexión verificada exitosamente con Mercado Pago',
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('⚠️ [Platform MP Sync Ping Error]:', err?.response?.data || err?.message);
      throw new BadRequestException(
        `Error al validar conexión con Mercado Pago (${latencyMs}ms): ${err?.response?.data?.message || err?.message || 'Fallo de autenticación'}`,
      );
    }
  }

  /**
   * Guarda credenciales manuales para la plataforma con validación previa de conectividad
   */
  async savePlatformManualCredentials(
    dto: SavePlatformCredentialsDto,
    adminUserId?: string,
  ) {
    if (!dto.accessToken) {
      throw new BadRequestException('El Access Token es obligatorio');
    }

    // Validar token contra /users/me de Mercado Pago
    let meData: any = null;
    try {
      const testRes = await axios.get('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${dto.accessToken}` },
        timeout: 7000,
      });
      meData = testRes.data;
    } catch (err: any) {
      throw new BadRequestException(
        `El Access Token proporcionado es inválido o expiró: ${err?.response?.data?.message || err?.message}`,
      );
    }

    let config = await this.platformPaymentConfigRepo.findOne({
      where: { provider: 'mercadopago' },
    });

    if (!config) {
      config = this.platformPaymentConfigRepo.create({ provider: 'mercadopago' });
    }

    config.mpUserId = meData?.id ? String(meData.id) : null;
    config.mpAccessToken = dto.accessToken;
    config.mpRefreshToken = null;
    config.mpPublicKey = dto.publicKey || null;
    config.mpTokenExpiresAt = null; // Tokens manuales no tienen expiración OAuth conocida
    config.isConnected = true;
    config.accountEmail = meData?.email || null;
    config.accountNickname = meData?.nickname || meData?.first_name || null;
    config.environment = meData?.site_status === 'active' ? 'production' : 'sandbox';
    config.connectedAt = new Date();
    config.lastSyncAt = new Date();
    if (adminUserId) {
      config.updatedByUserId = adminUserId;
    }

    await this.platformPaymentConfigRepo.save(config);

    return {
      success: true,
      message: 'Credenciales manuales de Mercado Pago guardadas y validadas exitosamente',
    };
  }

  /**
   * Daemon de renovación para el Cron de la plataforma
   */
  async renewPlatformTokensIfNeeded(): Promise<void> {
    await this.getActivePlatformMercadoPagoConfig();
  }
}
