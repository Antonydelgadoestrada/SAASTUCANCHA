import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Payment, PaymentType } from './payment.entity';
import { PaymentStatus } from './payment-status.enum';
import { BookingStatus } from '../booking/booking-status.enum';
import { BookingService } from '../booking/booking.service';
import { ClubService } from '../club/club.service';
import { Club } from '../club/club.entity';
import {MercadoPagoConfig, Preference, OAuth} from "mercadopago";
import {Payment as PaymentMp} from "mercadopago";
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { CreateManualBookingDto } from '../booking/create-booking.dto';
import { addMinutes, addSeconds, isBefore, format} from 'date-fns'
import { PaymentMethod } from './payment-method.enum';
import { ScheduleTemplateService } from '../schedule/schedule-template.service';
import { MailerService } from '../mailer/mailer.service';
import { Booking } from '../booking/booking.entity';
import { S3Service } from '../aws/s3.service';
import { CourtService } from '../court/court.service';
import { TransactionsService } from '../transactions/transactions.service';
import { MembershipService } from '../membership/membership.service';

@Injectable()
export class PaymentService {
  private mercadopago: MercadoPagoConfig;
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Club)
    private readonly clubRepo: Repository<Club>,
    private readonly bookingService: BookingService,
    private readonly clubsService: ClubService,
    private readonly scheduleTemplateService: ScheduleTemplateService,
    private readonly mailerService: MailerService,
    private readonly s3Service: S3Service,
    private readonly transactionsService: TransactionsService,
    @Inject(forwardRef(() => MembershipService))
    private readonly membershipService: MembershipService,
  ) {
    this.mercadopago = new MercadoPagoConfig({accessToken: process.env.MP_ACCESS_TOKEN})
  }

  findAll() {
    return this.paymentRepo.find({ relations: ['booking'] });
  }

  findOne(id: string) {
    return this.paymentRepo.findOne({ where: { id }, relations: ['booking'] });
  }

  create(data: Partial<Payment>) {
    const payment = this.paymentRepo.create(data);
    return this.paymentRepo.save(payment);
  }

  async update(id: string, data: Partial<Payment>) {
    await this.paymentRepo.update(id, data);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.paymentRepo.delete(id);
  }
 
  async handleOauthCallback(code: string, clubId: string) {
    try {
      if (!process.env.MP_CLIENT_ID || !process.env.MP_CLIENT_SECRET || !code || !process.env.SERVICES_URL) {
        console.error('⚠️ Faltan valores requeridos para OAuth de Mercado Pago:', {
          clientId: Boolean(process.env.MP_CLIENT_ID),
          clientSecret: Boolean(process.env.MP_CLIENT_SECRET),
          code: Boolean(code),
          servicesUrl: Boolean(process.env.SERVICES_URL),
        });
        return { redirect: `${process.env.WEB_SERVICES_URL}/club/payments?mp_error=missing_config` };
      }
      const credentials = await new OAuth(this.mercadopago).create({
        body: {
          client_id: process.env.MP_CLIENT_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.SERVICES_URL}/payments/oauth/callback`,
        },
      });
      const { access_token, refresh_token, user_id, expires_in } = credentials;
      const tokenExpiresAt = addSeconds(new Date(), expires_in || 15552000);
      await this.clubsService.updateClubWithMP(user_id, access_token, refresh_token, clubId, tokenExpiresAt);
      console.log(`✅ [MercadoPago OAuth] Club ${clubId} vinculado exitosamente con MP User ${user_id}`);
      return { redirect: `${process.env.WEB_SERVICES_URL}/club/payments?mp_status=connected` };
    } catch (error: any) {
      console.error('⚠️ [MercadoPago OAuth Callback Error]:', error?.response?.data || error?.message || error);
      return { redirect: `${process.env.WEB_SERVICES_URL}/club/payments?mp_error=expired_or_used` };
    }
  }

  async updateToken() {
    const clubs = await this.clubsService.findAllWithToken();
    const threshold = addMinutes(new Date(), 30); // renovar si expira en menos de 30 mins
    const oauth = new OAuth(this.mercadopago);

    for (const club of clubs) {
      if(!(club.mpTokenExpiresAt && isBefore(club.mpTokenExpiresAt, threshold))) continue
      try {
        const credentials = await oauth.refresh({
          body: {
            client_id: process.env.MP_CLIENT_ID,
            client_secret: process.env.MP_CLIENT_SECRET,
            refresh_token: club.mpRefreshToken,
          },
        });

        await this.clubsService.update(club.id, {
          mpAccessToken: credentials.access_token,
          mpRefreshToken: credentials.refresh_token,
          mpTokenExpiresAt: addSeconds(new Date(), credentials.expires_in),
        });

      } catch (error) {
        throw new Error(`Error al renovar token de ${club.name}, ${error.message}`);
      }
    }
  }

  async authorize(clubId:string){
    const url = new OAuth(this.mercadopago).getAuthorizationURL({
      options: {
        client_id: process.env.MP_CLIENT_ID,
        redirect_uri: `${process.env.SERVICES_URL}/payments/oauth/callback`,
        state:clubId
      },
    });

    // Devolvemos la url
    return url;
  }
  async createAndValidatePreference(dto: {
    courtId: string;
    userEmail: string;
    date: string;
    duration?: string;
    description?:string
  }) {
      
  }
  async createPreference(dto: CreateManualBookingDto, user: User){
    try{
      const bookings = await this.bookingService.createOnlineBooking(dto, user);
      if (Array.isArray(bookings)) {
        if (bookings.length === 1) {
          return await this.confirmPreference(bookings[0]);
        }
        return await this.confirmPreferenceMulti(bookings);
      }
      return await this.confirmPreference(bookings as any);
    }
    catch(error){
      throw new Error(`Error in createPreference, detail: ${error.message}`)
    }
  }
  
  async confirmPayment(dto: any){
    const booking = await this.bookingService.findOneComplete(dto.id);
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const totalPrice = Number((booking.pricing as any)?.totalPrice || 0);
    let amount: number | undefined = undefined;

    if (dto.amount !== undefined && dto.amount !== null) {
      const requestedAmount = Number(dto.amount);
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        throw new BadRequestException('Monto de pago inválido');
      }
      if (totalPrice > 0 && requestedAmount > totalPrice) {
        throw new BadRequestException('El monto solicitado supera el costo total de la reserva');
      }

      // Validar monto mínimo si se envía un pago parcial
      if (totalPrice > 0 && requestedAmount < totalPrice) {
        const clubConfig = booking.club?.id ? await this.clubsService.getPaymentConfig(booking.club.id) : null;
        if (clubConfig) {
          const minAdelanto = clubConfig.adelantoMinimo || 
            (clubConfig.porcentajeAdelantoDefault ? (totalPrice * clubConfig.porcentajeAdelantoDefault / 100) : 0);
          if (minAdelanto > 0 && requestedAmount < minAdelanto) {
            throw new BadRequestException(`El adelanto mínimo permitido es S/ ${minAdelanto.toFixed(2)}`);
          }
        }
      }
      amount = requestedAmount;
    } else {
      amount = totalPrice > 0 ? totalPrice : undefined;
    }

    return await this.confirmPreference(booking, amount);
  }

  async confirmPreference(booking: Booking, customAmount?: number){
    const mpAccessToken = booking.club?.mpAccessToken || process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      throw new BadRequestException('El club no tiene Mercado Pago conectado y no se encontró token por defecto');
    }
    const finalAmount = customAmount && customAmount > 0 ? customAmount : (booking.pricing?.totalPrice ?? 0);
    const isSaldo = customAmount && booking.pricing?.totalPrice && customAmount < booking.pricing.totalPrice;
    const title = isSaldo
      ? `Saldo restante - ${booking.court?.name || "Cancha"}`
      : `Reserva en ${booking.court?.name || "Cancha"}`;
    const bookingId = booking.id;
    const email = booking.user?.email || "";

    const isSandbox =
      mpAccessToken.startsWith('TEST-') ||
      process.env.MP_SANDBOX === 'true' ||
      process.env.NODE_ENV !== 'production';

    const webUrl = (process.env.WEB_SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://saastucancha.vercel.app' : 'http://localhost:3000')).replace(/\/+$/, '');
    const servicesUrl = (process.env.SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://saastucancha.onrender.com' : 'http://localhost:3001')).replace(/\/+$/, '');

    const testPayerEmail =
      process.env.MP_TEST_PAYER_EMAIL ||
      (email && email.includes('testuser.com') ? email : 'test_user_123@testuser.com');
    const payerEmail = isSandbox ? testPayerEmail : (email || testPayerEmail);

    // 2. Crear una instancia temporal de MercadoPago con el token del club
    const client = new MercadoPagoConfig({
      accessToken: mpAccessToken,
    });
  
    // 3. Crear la preferencia de pago
    const preferenceClient = new Preference(client);
    const response = await preferenceClient.create({
      body: {
        items: [
          {
            id: String(booking.court?.id || "court"),
            title: title,
            description: `Club: ${booking.club?.name || ""} | fecha: ${booking.date} | Superficie: ${booking.court?.surface || ""} | Duracion: ${booking.startTime}-${booking.endTime}`,
            quantity: 1,
            category_id: 'services',
            currency_id: 'PEN',
            unit_price: Number(Number(finalAmount).toFixed(2)),
          },
        ],
        payer: {
          email: payerEmail,
        },
        metadata: {
          email: payerEmail,
        },
        back_urls: {
          success: `${webUrl}/user/payments/success`,
          failure: `${webUrl}/user/payments/failure`,
          pending: `${webUrl}/user/payments/pending`,
        },
        notification_url: `${servicesUrl}/payments/webhook?clubId=${booking.club?.id}`,
        auto_return: 'approved',
        external_reference: `${bookingId}`,
        marketplace_fee: 5, // 💰 comisión
      },
    });
  
    const finalInitPoint = (isSandbox && response.sandbox_init_point) ? response.sandbox_init_point : (response.init_point || response.sandbox_init_point);
    // 4. Retornar el enlace
    return { init_point: finalInitPoint };
  }
  
  async confirmPreferenceMulti(bookings: Booking[]) {
    if (!bookings.length) throw new BadRequestException('No hay reservas creadas');
    const firstBooking = bookings[0];
    const mpAccessToken = firstBooking.club?.mpAccessToken || process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      throw new BadRequestException('El club no tiene Mercado Pago conectado y no se encontró token por defecto');
    }
    
    const email = firstBooking.user?.email || "";
    const bookingIds = bookings.map(b => b.id).join(',');

    const isSandbox =
      mpAccessToken.startsWith('TEST-') ||
      process.env.MP_SANDBOX === 'true' ||
      process.env.NODE_ENV !== 'production';

    const webUrl = (process.env.WEB_SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://saastucancha.vercel.app' : 'http://localhost:3000')).replace(/\/+$/, '');
    const servicesUrl = (process.env.SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://saastucancha.onrender.com' : 'http://localhost:3001')).replace(/\/+$/, '');

    const testPayerEmail =
      process.env.MP_TEST_PAYER_EMAIL ||
      (email && email.includes('testuser.com') ? email : 'test_user_123@testuser.com');
    const payerEmail = isSandbox ? testPayerEmail : (email || testPayerEmail);
    
    const client = new MercadoPagoConfig({
      accessToken: mpAccessToken,
    });
    const preferenceClient = new Preference(client);
    
    // Generar un item por cada reserva
    const items = bookings.map(b => ({
      id: String(b.court?.id || "court"),
      title: `Reserva en ${b.court?.name || "Cancha"}`,
      description: `Club: ${b.club?.name || ""} | fecha: ${b.date} | Superficie: ${b.court?.surface || ""} | Duracion: ${b.startTime}-${b.endTime}`,
      quantity: 1,
      category_id: 'services',
      currency_id: 'PEN',
      unit_price: Number(Number(b.pricing?.totalPrice || 0).toFixed(2)),
    }));
    
    const response = await preferenceClient.create({
      body: {
        items: items,
        payer: {
          email: payerEmail,
        },
        metadata: {
          email: payerEmail,
        },
        back_urls: {
          success: `${webUrl}/user/payments/success`,
          failure: `${webUrl}/user/payments/failure`,
          pending: `${webUrl}/user/payments/pending`,
        },
        notification_url: `${servicesUrl}/payments/webhook?clubId=${firstBooking.club?.id}`,
        auto_return: 'approved',
        external_reference: bookingIds, // Pasamos la lista de IDs separados por coma
        marketplace_fee: 5,
      },
    });
  
    const finalInitPoint = (isSandbox && response.sandbox_init_point) ? response.sandbox_init_point : (response.init_point || response.sandbox_init_point);
    return { init_point: finalInitPoint };
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
  async handleMercadoPagoWebhook(query: any, body?: any, headers: Record<string, string> = {}) {
    const { type, 'data.id': paymentIdQuery, clubId } = query;
    const paymentId = paymentIdQuery || query?.id || body?.data?.id || body?.id;
  
    if (type !== 'payment' || !paymentId) {
      return;
    }

    // 0. Validación de Firma Criptográfica HMAC-SHA256 (SEC-012)
    const verification = this.verifyWebhookSignature(String(paymentId), headers);
    if (!verification.valid) {
      if (verification.reason === 'Falta cabecera x-signature') {
        // Modo Contingencia: Notificación legacy / IPN o ping de prueba sin cabecera
        console.warn(`⚠️ [Webhook MP] Alerta de seguridad: Notificación recibida sin cabecera x-signature para pago ${paymentId}. Continuando con verificación de servidor a servidor (Tier 2 API)...`);
      } else {
        // Intento de spoofing, firma adulterada o secreto incorrecto
        console.error(`🚨 [Webhook MP] Intento de firma inválida o adulterada para pago ${paymentId}: ${verification.reason}`);
        throw new UnauthorizedException(`Firma HMAC de webhook inválida: ${verification.reason}`);
      }
    } else if (verification.reason) {
      // Modo Contingencia: MP_WEBHOOK_SECRET no configurado
      console.warn(`⚠️ [Webhook MP] ${verification.reason}`);
    } else {
      console.log(`✅ [Webhook MP] Firma HMAC-SHA256 validada con éxito para pago ${paymentId}`);
    }

    try {
      // 1. Verificación rápida de idempotencia por transactionId existente
      const existingPayment = await this.paymentRepo.findOne({
        where: { transactionId: String(paymentId) },
        relations: ['bookings', 'bookings.club', 'bookings.court', 'bookings.court.club'],
      });

      if (existingPayment && existingPayment.status === PaymentStatus.PAID) {
        console.log(`ℹ️ [Webhook Idempotente] El pago ${paymentId} ya fue procesado y aprobado previamente.`);
        return;
      }

      // 2. Obtener datos del pago desde la API de Mercado Pago con fallback resiliente
      let mpPayment: any = null;
      // Intento 1: Con token de plataforma
      try {
        mpPayment = await new PaymentMp(this.mercadopago).get({ id: String(paymentId) });
      } catch (errPlat: any) {
        console.warn(`[Webhook MP] Consulta con token maestro falló para ID ${paymentId}: ${errPlat.message}. Intentando token del Club...`);
      }

      // Intento 2: Con token del Club si viene user_id (collector) en el webhook
      const collectorUserId = body?.user_id || query?.user_id;
      if (!mpPayment && collectorUserId) {
        const clubCollector = await this.clubRepo.findOne({ where: { mpUserId: String(collectorUserId) } });
        if (clubCollector?.mpAccessToken) {
          try {
            const clubClient = new MercadoPagoConfig({ accessToken: clubCollector.mpAccessToken });
            mpPayment = await new PaymentMp(clubClient).get({ id: String(paymentId) });
          } catch (errClub: any) {
            console.warn(`[Webhook MP] Consulta con token de club collector (${collectorUserId}) falló: ${errClub.message}`);
          }
        }
      }

      // Intento 3: Con token del Club indicado por el webhook
      if (!mpPayment && clubId) {
        const webhookClub = await this.clubsService.findOne(String(clubId));
        if (webhookClub?.mpAccessToken) {
          try {
            const clubClient = new MercadoPagoConfig({ accessToken: webhookClub.mpAccessToken });
            mpPayment = await new PaymentMp(clubClient).get({ id: String(paymentId) });
          } catch (errClub: any) {
            console.warn(`[Webhook MP] Consulta con token del club ${clubId} falló: ${errClub.message}`);
          }
        }
      }

      // Intento 4: Con token del Club del pago existente si estaba precargado
      if (!mpPayment && existingPayment?.bookings?.[0]?.club?.mpAccessToken) {
        try {
          const clubClient = new MercadoPagoConfig({ accessToken: existingPayment.bookings[0].club.mpAccessToken });
          mpPayment = await new PaymentMp(clubClient).get({ id: String(paymentId) });
        } catch (errExist: any) {
          console.warn(`[Webhook MP] Consulta con token de pago existente falló: ${errExist.message}`);
        }
      }

      if (!mpPayment) {
        console.error(`❌ [Webhook MP] Imposible obtener datos del pago ${paymentId} desde Mercado Pago.`);
        return { received: true, error: 'payment_not_retrievable' };
      }

      const externalRef = mpPayment.external_reference;
      const status = mpPayment.status;
  
      if (!externalRef) {
        console.warn(`⚠️ Pago recibido sin external_reference, ID: ${paymentId}`);
        return;
      }
      if (externalRef.startsWith('membership_')) {
        console.log(`🎟️ [Webhook MP] Delegando pago de membresía ID ${paymentId} a MembershipService`);
        await this.membershipService.handleMembershipWebhook(query, body);
        return { received: true, membership: true };
      }
      // 3. Extraer datos financieros y método de pago
      const totalPagado = mpPayment.transaction_amount ?? 0;
      const netoVendedor = mpPayment.transaction_details?.net_received_amount ?? 0;
      const comisionMp = mpPayment.fee_details?.find(f => f.type === 'mercadopago_fee')?.amount ?? 0;
      const comisionApp = (mpPayment as any).application_fee ?? 0;
  
      const paymentType = mpPayment.payment_type_id || '';
      const paymentMethod = mpPayment.payment_method_id || '';

      let mappedMethod = PaymentMethod.CARD;
      const methodLower = paymentMethod.toLowerCase();
      const typeLower = paymentType.toLowerCase();
      if (methodLower.includes('yape') || typeLower.includes('yape')) {
        mappedMethod = PaymentMethod.YAPE;
      } else if (methodLower.includes('plin') || typeLower.includes('plin')) {
        mappedMethod = PaymentMethod.PLIN;
      } else if (methodLower.includes('transfer') || typeLower.includes('bank_transfer')) {
        mappedMethod = PaymentMethod.TRANSFER;
      } else {
        mappedMethod = PaymentMethod.CARD;
      }
  
      let targetPaymentStatus: PaymentStatus;
      let targetBookingStatus: BookingStatus;
      let correoAEnviar: 'pago_exitoso' | 'pago_rechazado' | null = null;
  
      switch (status) {
        case 'approved':
          targetPaymentStatus = PaymentStatus.PAID;
          targetBookingStatus = BookingStatus.CONFIRMED;
          correoAEnviar = 'pago_exitoso';
          break;
  
        case 'rejected':
          targetPaymentStatus = PaymentStatus.REJECTED;
          targetBookingStatus = BookingStatus.CANCELLED;
          correoAEnviar = 'pago_rechazado';
          break;
  
        default:
          targetPaymentStatus = PaymentStatus.PENDING;
          targetBookingStatus = BookingStatus.PENDING;
          break;
      }

      // 4. Ejecución atómica en transacción
      const updatedBookings = await this.paymentRepo.manager.transaction(async (trxManager) => {
        const bookingIds = externalRef.split(',');
        const bookings = await trxManager.find(Booking, {
          where: { id: In(bookingIds) },
          relations: ['user', 'court', 'club']
        });
        
        if (!bookings.length) {
          console.warn(`Reserva no encontrada para referencia externa: ${externalRef}`);
          return null;
        }

        // Si ya está pagado por otra solicitud concurrente, abortar
        if (bookings[0].paymentStatus === PaymentStatus.PAID && targetPaymentStatus === PaymentStatus.PAID) {
          console.log(`ℹ️ [Concurrencia] Reservas ya marcadas como PAID.`);
          return bookings;
        }

        let paymentRecord = existingPayment || await trxManager.findOne(Payment, {
          where: { transactionId: String(mpPayment.id) },
        });

        const expectedTotal = bookings.length === 1 ? Number((bookings[0].pricing as any)?.totalPrice || 0) : 0;
        const isPartial = expectedTotal > 0 && totalPagado < (expectedTotal - 0.05);
        const resolvedType = isPartial ? PaymentType.ADELANTO : PaymentType.PAGO_COMPLETO;
        const resolvedSaldoStatus = isPartial ? 'PENDIENTE' : 'NO_APLICA';
        const resolvedSaldoAmount = isPartial ? Number((expectedTotal - totalPagado).toFixed(2)) : 0;

        if (paymentRecord) {
          paymentRecord.status = targetPaymentStatus;
          paymentRecord.amount = totalPagado;
          paymentRecord.netAmount = netoVendedor;
          paymentRecord.feeAmount = comisionMp + comisionApp;
          paymentRecord.paymentType = paymentType;
          paymentRecord.paymentMethod = paymentMethod;
          paymentRecord.type = resolvedType;
          paymentRecord.saldoStatus = resolvedSaldoStatus;
          paymentRecord.saldoAmount = resolvedSaldoAmount;
          paymentRecord.gatewayResponse = mpPayment;
          await trxManager.save(Payment, paymentRecord);
        } else {
          paymentRecord = trxManager.create(Payment, {
            user: bookings[0].user,
            amount: totalPagado,
            currency: mpPayment.currency_id || 'PEN',
            method: mappedMethod,
            status: targetPaymentStatus,
            transactionId: String(mpPayment.id),
            netAmount: netoVendedor,
            feeAmount: comisionMp + comisionApp,
            paymentType,
            paymentMethod,
            type: resolvedType,
            saldoStatus: resolvedSaldoStatus,
            saldoAmount: resolvedSaldoAmount,
            gatewayResponse: mpPayment,
          });
          await trxManager.save(Payment, paymentRecord);
        }

        for (let booking of bookings) {
          booking.paymentStatus = targetPaymentStatus;
          booking.status = targetBookingStatus;
          // Preservar precio total de la reserva y registrar monto pagado
          if (bookings.length === 1) {
            const currentTotal = (booking.pricing as any)?.totalPrice;
            booking.pricing = {
              ...booking.pricing,
              basePrice: (booking.pricing as any)?.basePrice ?? netoVendedor,
              totalPrice: currentTotal && Number(currentTotal) > 0 ? Number(currentTotal) : totalPagado,
            } as any;
          }
          booking.payment = paymentRecord;
          await trxManager.save(Booking, booking);
        }
        
        return bookings;
      });

      if (!updatedBookings) {
        return;
      }
  
      // 5. Ocupar slots en calendario si el pago fue aprobado
      if (status === 'approved') {
        for (let booking of updatedBookings) {
          await this.generateSlotOccupied(
            booking.court.id,
            booking.date,
            booking.startTime,
            booking.duration
          );
        }
      }
  
      // 6. Enviar correos informativos sin bloquear la respuesta del webhook
      try {
        if (correoAEnviar === 'pago_exitoso') {
          // Send for the first one as representative or a group email
          await this.mailerService.sendBookingConfirmationEmail(updatedBookings[0].customerInfo.email, updatedBookings[0]);
          await this.mailerService.sendBookingPaidNotifications(updatedBookings[0]);
        } else if (correoAEnviar === 'pago_rechazado') {
          await this.mailerService.sendBookingCancelledEmail(updatedBookings[0].customerInfo.email, updatedBookings[0]);
        }
      } catch (mailErr) {
        console.error(`⚠️ Error al enviar correos de confirmación: ${mailErr.message}`);
      }
  
      if (status === 'approved' || status === 'authorized') {
        for (const bk of updatedBookings) {
          if (bk.payment) {
            this.transactionsService.recordFromMercadoPago(bk.payment, bk).catch(() => {});
          }
        }
      }

      console.log(`✅ [Webhook MP] Pago ${paymentId} procesado exitosamente como ${targetPaymentStatus} para booking(s): ${externalRef}`);
      return { received: true, status: targetPaymentStatus };
    } catch (error: any) {
      console.error(`Error al procesar webhook para ID ${paymentId}:`, error?.message || error);
      return { received: true, error: error?.message || 'internal_error' };
    }
  }

  /**
   * Endpoint de sincronización y verificación inmediata llamado al retornar de Mercado Pago
   */
  async verifyPayment(dto: { paymentId: string; externalReference?: string }, user?: User) {
    const { paymentId, externalReference } = dto;
    if (!paymentId) throw new BadRequestException('Se requiere paymentId');

    // Procesar con la lógica del webhook de forma sincrónica
    await this.handleMercadoPagoWebhook(
      { type: 'payment', id: paymentId },
      { data: { id: paymentId } },
    );

    // Consultar el estado actualizado en la BD
    let booking: Booking | null = null;
    if (externalReference) {
      const firstId = externalReference.split(',')[0].trim();
      booking = await this.bookingService.findOneComplete(firstId);
    }
    if (!booking) {
      const payment = await this.paymentRepo.findOne({
        where: { transactionId: String(paymentId) },
        relations: ['bookings', 'bookings.court', 'bookings.court.club', 'bookings.club', 'user'],
      });
      booking = payment?.bookings?.[0] || null;
    }

    const isPaid = booking?.paymentStatus === PaymentStatus.PAID;
    return {
      success: isPaid,
      status: booking?.paymentStatus || 'pending',
      bookingStatus: booking?.status || 'pending',
      booking: booking
        ? {
            id: booking.id,
            bookingReference: booking.bookingReference,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            courtName: booking.court?.name,
            clubName: booking.club?.name || booking.court?.club?.name,
            totalPrice: booking.pricing?.totalPrice,
            paymentStatus: booking.paymentStatus,
          }
        : null,
    };
  }

  async generateSlotAvailable(courtId: string, date: any, startTime: string, duration: any) {
    const dateStr = typeof date === 'string'
      ? date.substring(0, 10)
      : (date instanceof Date
          ? (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
              ? date.toISOString().substring(0, 10)
              : format(date, 'yyyy-MM-dd'))
          : format(new Date(date), 'yyyy-MM-dd'));
    const times = this.generateTimeSlots(startTime, duration);
    const payload = times.map((t) => ({
      courtId,
      date: dateStr,
      time: t,
      status: 'available',
    }));
    await this.scheduleTemplateService.bulkUpdate(payload as any);
  }

  // ─── MÉTRICAS DEL CLUB ─────────────────────────────────────────────────────

  async getClubPaymentMetrics(user: User, clubIdParam?: string) {
    const clubId = clubIdParam || user.club?.id;
    if (!clubId) {
      throw new BadRequestException('El usuario no tiene un club asociado');
    }

    const paymentQuery = `
      SELECT 
        p.id as "paymentId", p.status as "paymentStatus", p.amount, p."saldoStatus", p."saldoAmount", 
        p.method, p."saldoMethod", p.type as "paymentType",
        b.id as "bookingId", b.pricing, b.duration, b.status as "bookingStatus",
        c."priceDay", c."priceNight"
      FROM payment p
      LEFT JOIN payment_bookings_booking pbb ON p.id = pbb."paymentId"
      LEFT JOIN booking b ON pbb."bookingId" = b.id
      LEFT JOIN court c ON b."courtId" = c.id
      WHERE b."clubId" = $1 OR c."clubId" = $1
    `;

    const bookingQuery = `
      SELECT 
        b.id, b.pricing, b.duration, b.status, b."paymentStatus", b."paymentMethod", b."proofOfPaymentUrl",
        c."priceDay", c."priceNight"
      FROM booking b
      LEFT JOIN court c ON b."courtId" = c.id
      LEFT JOIN payment_bookings_booking pbb ON b.id = pbb."bookingId"
      WHERE (b."clubId" = $1 OR c."clubId" = $1)
      AND pbb."paymentId" IS NULL
    `;
    
    const [rawPayments, rawBookings] = await Promise.all([
      this.paymentRepo.query(paymentQuery, [clubId]),
      this.bookingRepo.query(bookingQuery, [clubId])
    ]);

    const paymentsMap = new Map();
    for (const row of rawPayments) {
      if (!paymentsMap.has(row.paymentId)) {
        paymentsMap.set(row.paymentId, {
          id: row.paymentId,
          status: row.paymentStatus,
          amount: Number(row.amount) || 0,
          saldoStatus: row.saldoStatus,
          saldoAmount: Number(row.saldoAmount) || 0,
          method: row.method,
          saldoMethod: row.saldoMethod,
          type: row.paymentType,
          bookings: []
        });
      }
      if (row.bookingId) {
        paymentsMap.get(row.paymentId).bookings.push({
          id: row.bookingId,
          pricing: typeof row.pricing === 'string' ? row.pricing : JSON.stringify(row.pricing || {}),
          duration: row.duration,
          status: row.bookingStatus,
          court: {
            priceDay: row.priceDay,
            priceNight: row.priceNight
          }
        });
      }
    }
    const payments = Array.from(paymentsMap.values());

    const allClubBookings = rawBookings.map(row => ({
      id: row.id,
      pricing: typeof row.pricing === 'string' ? row.pricing : JSON.stringify(row.pricing || {}),
      duration: row.duration,
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentMethod,
      proofOfPaymentUrl: row.proofOfPaymentUrl,
      court: {
        priceDay: row.priceDay,
        priceNight: row.priceNight
      }
    }));

    let totalRecaudado = 0;
    let recaudadoMercadoPago = 0;
    let recaudadoYape = 0;
    let recaudadoPlin = 0;
    let recaudadoTransfer = 0;
    let recaudadoEfectivo = 0;
    let comprobantesPendientesCount = 0;
    let totalConfirmadosCount = 0;
    let totalRechazadosCount = 0;
    let saldoPendienteTotal = 0;

    const processedBookingIds = new Set<string>();

    for (const p of payments) {
      if (p.bookings) {
        for (const b of p.bookings) {
          processedBookingIds.add(b.id);
        }
      }

      const isConfirmed = p.status === PaymentStatus.PAID || (p.status as string) === 'CONFIRMADO';
      const isPending = p.status === PaymentStatus.PENDING || (p.status as string) === 'PENDIENTE';
      const isRejected = p.status === PaymentStatus.REJECTED || (p.status as string) === 'RECHAZADO';
      const amount = Number(p.amount) || 0;
      const isSaldoPaid = p.saldoStatus === 'PAGADO';
      const saldoAmount = Number(p.saldoAmount || 0);

      // Calcular precio total de la reserva
      let totalPrice = 0;
      const firstBooking = p.bookings?.[0];
      if (firstBooking && typeof firstBooking.pricing === 'object' && firstBooking.pricing !== null) {
        totalPrice = Number((firstBooking.pricing as any).totalPrice ?? (firstBooking.pricing as any).basePrice);
      } else if (firstBooking && typeof firstBooking.pricing === 'string') {
        try {
          const parsed = JSON.parse(firstBooking.pricing);
          totalPrice = Number(parsed?.totalPrice ?? parsed?.basePrice);
        } catch {}
      }
      if (isNaN(totalPrice) || totalPrice <= 0) {
        const courtPrice = Number(firstBooking?.court?.priceDay || firstBooking?.court?.priceNight || 0);
        const dur = Number(firstBooking?.duration || 1);
        totalPrice = courtPrice * dur * 2;
      }
      if (isNaN(totalPrice) || totalPrice <= 0) {
        totalPrice = amount;
      }

      // Si la reserva no está rechazada y el saldo NO está liquidado, sumar lo que falta a saldo por cobrar
      if (!isRejected && !isSaldoPaid && (p.type === PaymentType.ADELANTO || totalPrice > amount)) {
        saldoPendienteTotal += Math.max(0, totalPrice - amount);
      }

      if (isConfirmed) {
        totalRecaudado += amount;
        totalConfirmadosCount++;
        if (p.method === PaymentMethod.YAPE) recaudadoYape += amount;
        else if (p.method === PaymentMethod.PLIN) recaudadoPlin += amount;
        else if ((p.method as string) === 'TRANSFERENCIA') recaudadoTransfer += amount;
        else if ((p.method as string) === 'EFECTIVO') recaudadoEfectivo += amount;
        else recaudadoMercadoPago += amount;

        // Si se cobró saldo restante adicional, sumarlo a recaudación y al método correspondiente
        if (isSaldoPaid && saldoAmount > 0) {
          totalRecaudado += saldoAmount;
          const sMethod = (p.saldoMethod || 'EFECTIVO').toUpperCase();
          if (sMethod.includes('YAPE')) recaudadoYape += saldoAmount;
          else if (sMethod.includes('PLIN')) recaudadoPlin += saldoAmount;
          else if (sMethod.includes('TRANSFER')) recaudadoTransfer += saldoAmount;
          else if (sMethod.includes('EFECTIVO')) recaudadoEfectivo += saldoAmount;
          else recaudadoMercadoPago += saldoAmount;
        }
      } else if (isPending) {
        comprobantesPendientesCount++;
      } else if (isRejected) {
        totalRechazadosCount++;
      }
    }

    // Process bookings that don't have a Payment row yet
    for (const b of allClubBookings) {
      if (!processedBookingIds.has(b.id)) {
        let totalPrice = 0;
        if (b.pricing && typeof b.pricing === 'object') {
          totalPrice = Number((b.pricing as any).totalPrice ?? (b.pricing as any).basePrice ?? 0);
        }
        if (isNaN(totalPrice) || totalPrice <= 0) {
          const courtPrice = Number(b.court?.priceDay || b.court?.priceNight || 0);
          const dur = Number(b.duration || 1);
          totalPrice = courtPrice * dur * 2;
        }

        const isPaid = b.paymentStatus === PaymentStatus.PAID || (b.paymentStatus as any) === 'paid';
        const isCancelled = b.status === BookingStatus.CANCELLED || (b.status as any) === 'cancelled';

        if (isCancelled) {
          totalRechazadosCount++;
        } else if (isPaid) {
          totalConfirmadosCount++;
          totalRecaudado += totalPrice;
          const meth = (b.paymentMethod || '').toUpperCase();
          if (meth.includes('YAPE')) recaudadoYape += totalPrice;
          else if (meth.includes('PLIN')) recaudadoPlin += totalPrice;
          else if (meth.includes('TRANSFER')) recaudadoTransfer += totalPrice;
          else if (meth.includes('EFECTIVO') || meth.includes('MANUAL')) recaudadoEfectivo += totalPrice;
          else recaudadoMercadoPago += totalPrice;
        } else {
          // Pending reservation
          saldoPendienteTotal += totalPrice;
          if (b.proofOfPaymentUrl) {
            comprobantesPendientesCount++;
          }
        }
      }
    }

    const recaudadoManual = recaudadoYape + recaudadoPlin + recaudadoTransfer + recaudadoEfectivo;

    return {
      clubId,
      totalRecaudado: Number(totalRecaudado.toFixed(2)),
      recaudadoMercadoPago: Number(recaudadoMercadoPago.toFixed(2)),
      recaudadoManual: Number(recaudadoManual.toFixed(2)),
      saldoPendienteTotal: Number(saldoPendienteTotal.toFixed(2)),
      comprobantesPendientesCount,
      totalConfirmadosCount,
      totalRechazadosCount,
      desgloseMetodos: {
        mercadopago: Number(recaudadoMercadoPago.toFixed(2)),
        yape: Number(recaudadoYape.toFixed(2)),
        plin: Number(recaudadoPlin.toFixed(2)),
        transferencia: Number(recaudadoTransfer.toFixed(2)),
        efectivo: Number(recaudadoEfectivo.toFixed(2)),
      },
    };
  }

  // ─── LISTA DE PAGOS Y RESERVAS CON FILTROS ─────────────────────────────────

  async getClubPaymentsList(
    user: User,
    filters: { status?: string; method?: string; type?: string; search?: string },
  ) {
    const clubId = user.club?.id;
    if (!clubId && (user.role as string) !== 'ADMIN') {
      throw new BadRequestException('El usuario no tiene un club asociado');
    }

    const query = this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.bookings', 'booking')
      .leftJoinAndSelect('booking.court', 'court')
      .leftJoinAndSelect('booking.user', 'customer')
      .leftJoinAndSelect('payment.user', 'payer')
      .leftJoinAndSelect('payment.confirmadoPor', 'confirmadoPor')
      .leftJoinAndSelect('payment.saldoConfirmadoPor', 'saldoConfirmadoPor')
      .orderBy('payment.createdAt', 'DESC');

    if (clubId) {
      query.andWhere('(booking.clubId = :clubId OR court.clubId = :clubId)', { clubId });
    }

    // Optimización SQL: Búsqueda directa en base de datos para no saturar la memoria JS
    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where('booking.bookingReference ILIKE :s', { s })
            .orWhere('CAST(payment.id AS TEXT) ILIKE :s', { s })
            .orWhere('court.name ILIKE :s', { s })
            .orWhere('customer.name ILIKE :s', { s })
            .orWhere('customer.email ILIKE :s', { s })
            .orWhere('payer.name ILIKE :s', { s })
            .orWhere('payer.email ILIKE :s', { s });
        })
      );
    }

    // Prevenir colapso de memoria limitando la carga a los últimos 400 registros
    query.take(400);

    const rawPayments = await query.getMany();

    // Query all club bookings to make sure no booking is missed
    const bookingsQuery = this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.court', 'court')
      .leftJoinAndSelect('b.user', 'customer')
      .leftJoinAndSelect('b.payment', 'payment')
      .orderBy('b.createdAt', 'DESC');

    if (clubId) {
      bookingsQuery.andWhere('(b.clubId = :clubId OR court.clubId = :clubId)', { clubId });
    }

    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      bookingsQuery.andWhere(
        new Brackets((qb) => {
          qb.where('b.bookingReference ILIKE :s', { s })
            .orWhere('CAST(payment.id AS TEXT) ILIKE :s', { s })
            .orWhere('court.name ILIKE :s', { s })
            .orWhere('customer.name ILIKE :s', { s })
            .orWhere('customer.email ILIKE :s', { s });
        })
      );
    }

    bookingsQuery.take(400);

    const allClubBookings = await bookingsQuery.getMany();

    const existingBookingIds = new Set<string>();
    for (const p of rawPayments) {
      if (p.bookings) {
        for (const b of p.bookings) {
          existingBookingIds.add(b.id);
        }
      }
    }

    const unlinkedPaymentItems: any[] = [];
    for (const b of allClubBookings) {
      if (!existingBookingIds.has(b.id)) {
        let totalPrice = 0;
        if (b.pricing && typeof b.pricing === 'object') {
          totalPrice = Number((b.pricing as any).totalPrice ?? (b.pricing as any).basePrice ?? 0);
        }
        if (isNaN(totalPrice) || totalPrice <= 0) {
          const courtPrice = Number(b.court?.priceDay || b.court?.priceNight || 0);
          const dur = Number(b.duration || 1);
          totalPrice = courtPrice * dur * 2;
        }

        const isPaid = b.paymentStatus === PaymentStatus.PAID || (b.paymentStatus as any) === 'PAID' || (b.paymentStatus as any) === 'paid';
        const isCancelled = b.status === BookingStatus.CANCELLED || (b.status as any) === 'CANCELLED' || (b.status as any) === 'cancelled';

        let method = PaymentMethod.EFECTIVO;
        const bMeth = (b.paymentMethod || '').toUpperCase();
        if (bMeth.includes('YAPE')) method = PaymentMethod.YAPE;
        else if (bMeth.includes('PLIN')) method = PaymentMethod.PLIN;
        else if (bMeth.includes('MERCADO') || bMeth.includes('MP') || bMeth.includes('ONLINE')) method = PaymentMethod.MERCADOPAGO;
        else if (bMeth.includes('TRANSFER')) method = PaymentMethod.TRANSFERENCIA;
        else if (bMeth.includes('WHATSAPP')) method = PaymentMethod.WHATSAPP;

        unlinkedPaymentItems.push({
          id: b.id,
          amount: totalPrice,
          currency: 'PEN',
          method,
          paymentMethod: b.paymentMethod || method,
          status: isCancelled ? PaymentStatus.REJECTED : (isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING),
          type: PaymentType.PAGO_COMPLETO,
          comprobanteUrl: b.proofOfPaymentUrl || null,
          motivoRechazo: b.cancellationReason || null,
          createdAt: b.createdAt || new Date(),
          saldoStatus: isPaid ? 'NO_APLICA' : 'PENDIENTE',
          saldoAmount: 0,
          pendingAudit: Boolean(b.proofOfPaymentUrl && !isPaid && !isCancelled),
          autoConfirmed: false,
          bookings: [b],
          user: b.user,
        });
      }
    }

    const combinedList = [...rawPayments, ...unlinkedPaymentItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const formattedList = combinedList.map((p) => {
      const b = p.bookings?.[0] || null;
      const customerName = b?.customerInfo?.name || b?.user?.name || p.user?.name || 'Cliente';
      const customerEmail = b?.customerInfo?.email || b?.user?.email || p.user?.email || '';
      const customerPhone = b?.customerInfo?.phone || b?.user?.phone || '';

      const bFormatted = b
        ? {
            ...b,
            customerInfo: {
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
            },
            court: b.court,
            pricing: b.pricing,
            date: b.date,
            startTime: b.startTime,
            duration: b.duration,
            bookingReference: (b as any).bookingReference || (p as any).bookingReference,
          }
        : null;

      let computedSaldoStatus = p.saldoStatus;
      let totalPrice = 0;
      if (b && typeof b.pricing === 'object' && b.pricing !== null) {
        totalPrice = Number((b.pricing as any).totalPrice ?? (b.pricing as any).basePrice);
      }
      if (isNaN(totalPrice) || totalPrice <= 0) {
        totalPrice = Number(p.amount || 0);
      }

      if (p.type === PaymentType.PAGO_COMPLETO || Number(p.amount || 0) >= totalPrice - 0.05) {
        computedSaldoStatus = p.saldoStatus === 'PAGADO' ? 'PAGADO' : 'NO_APLICA';
      }

      return {
        ...p,
        saldoStatus: computedSaldoStatus,
        booking: bFormatted,
      };
    });

    let result = formattedList;

    if (filters.status && filters.status !== 'all') {
      const st = filters.status.toLowerCase().trim();
      result = result.filter((p) => {
        const normStatus = String(p.status || '').toLowerCase();
        if (st === 'pending' || st === 'pendiente') {
          return normStatus === 'pending' || normStatus === 'pendiente' || p.pendingAudit === true;
        } else if (st === 'pending_audit') {
          return p.pendingAudit === true;
        } else if (st === 'confirmed' || st === 'confirmado' || st === 'paid' || st === 'completed') {
          return ['paid', 'confirmado', 'confirmed', 'completed', 'approved'].includes(normStatus);
        } else if (st === 'rejected' || st === 'rechazado') {
          return ['rejected', 'rechazado', 'failed', 'cancelled', 'cancelado'].includes(normStatus);
        }
        return normStatus === st;
      });
    }

    if (filters.method && filters.method !== 'all') {
      const meth = filters.method.toUpperCase().trim();
      result = result.filter((p) => {
        const pMethod = String(p.method || (p as any).paymentMethod || '').toUpperCase();
        if (meth.includes('MERCADO') || meth === 'MP' || meth.includes('CARD')) {
          return pMethod.includes('MERCADO') || pMethod.includes('MP') || pMethod.includes('CARD') || pMethod.includes('ONLINE');
        } else if (meth.includes('YAPE')) {
          return pMethod.includes('YAPE');
        } else if (meth.includes('PLIN')) {
          return pMethod.includes('PLIN');
        } else if (meth.includes('TRANSFER')) {
          return pMethod.includes('TRANSFER');
        } else if (meth.includes('EFECTIVO') || meth.includes('CASH')) {
          return pMethod.includes('EFECTIVO') || pMethod.includes('CASH') || pMethod.includes('MANUAL');
        }
        return pMethod === meth;
      });
    }

    if (filters.type && filters.type !== 'all') {
      const tp = filters.type.toUpperCase().trim();
      result = result.filter((p) => {
        const pType = String(p.type || '').toUpperCase();
        if (tp.includes('ADELANTO') || tp.includes('ADVANCE')) {
          return pType.includes('ADELANTO') || pType.includes('ADVANCE');
        } else if (tp.includes('SALDO') || tp.includes('BALANCE')) {
          return pType.includes('SALDO') || pType.includes('BALANCE');
        } else if (tp.includes('COMPLETO') || tp.includes('FULL') || tp.includes('PAGO_COMPLETO')) {
          return pType.includes('COMPLETO') || pType.includes('FULL') || pType === '';
        }
        return pType === tp;
      });
    }

    if (filters.search) {
      const s = filters.search.toLowerCase().trim();
      result = result.filter((p) => {
        const ref = (p.bookings?.[0] as any)?.bookingReference?.toLowerCase() || p.booking?.bookingReference?.toLowerCase() || p.id.toLowerCase();
        const court = p.bookings?.[0]?.court?.name?.toLowerCase() || p.booking?.court?.name?.toLowerCase() || '';
        const name = p.booking?.customerInfo?.name?.toLowerCase() || (p.bookings?.[0] as any)?.user?.name?.toLowerCase() || p.user?.name?.toLowerCase() || '';
        const email = p.booking?.customerInfo?.email?.toLowerCase() || (p.bookings?.[0] as any)?.user?.email?.toLowerCase() || p.user?.email?.toLowerCase() || '';
        const phone = p.booking?.customerInfo?.phone?.toLowerCase() || (p.bookings?.[0] as any)?.user?.phone?.toLowerCase() || '';
        return ref.includes(s) || court.includes(s) || name.includes(s) || email.includes(s) || phone.includes(s);
      });
    }

    return result;
  }

  generateTimeSlots(start: string, duration: number): string[] {
    const [hours, minutes] = start.split(':').map(Number);
    const startDate = new Date(0, 0, 0, hours, minutes);
  
    const numberOfSlots = duration * 2; // porque 0.5h = 30min
    const slots: string[] = [];
  
    for (let i = 0; i < numberOfSlots; i++) {
      const slotTime = addMinutes(startDate, i * 30);
      slots.push(format(slotTime, 'HH:mm'));
    }
  
    return slots;
  }
  async generateSlotOccupied(courtId,date,startTime, duration){
    const dateStr = typeof date === 'string'
      ? date.substring(0, 10)
      : (date instanceof Date
          ? (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
              ? date.toISOString().substring(0, 10)
              : format(date, 'yyyy-MM-dd'))
          : format(new Date(date), 'yyyy-MM-dd'));
    const times = this.generateTimeSlots(startTime, duration); 
    // Con overrides-only puede que no existan filas todavía.
    // Creamos/actualizamos ocupados por (courtId,date,time).
    const payload = times.map((t) => ({
      courtId,
      date: dateStr,
      time: t,
      status: 'occupied',
    }));
    await this.scheduleTemplateService.bulkUpdate(payload as any);
  }

  /**
   * Subir captura de comprobante a Amazon S3
   */
  async uploadReceiptFile(file: any): Promise<{ url: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no provisto o inválido');
    }
    const safeName = (file.originalname || `comprobante-${Date.now()}.png`).replace(/\s+/g, '_');
    const url = await this.s3Service.uploadFile(file.buffer, safeName, file.mimetype, 'comprobantes-pago');
    return { url };
  }

  /**
   * Registrar pago manual (Yape, Plin, Transferencia) con comprobante para una reserva
   */
  async createBookingManualPayment(
    dto: {
      bookingId: string;
      method?: PaymentMethod;
      type?: PaymentType;
      amount?: number;
      comprobanteUrl?: string;
      currency?: string;
      metodo?: string;
      tipo?: string;
      monto?: number;
    },
    user: User,
  ) {
    const booking = await this.bookingService.findOneComplete(dto.bookingId);
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    // Parse safe method
    const rawMethod = (dto.method || dto.metodo || 'YAPE').toString().toUpperCase();
    let safeMethod: PaymentMethod = PaymentMethod.YAPE;
    if (rawMethod.includes('PLIN')) {
      safeMethod = PaymentMethod.PLIN;
    } else if (rawMethod.includes('TRANSFER')) {
      safeMethod = PaymentMethod.TRANSFERENCIA;
    } else if (rawMethod.includes('CASH') || rawMethod.includes('EFECTIVO')) {
      safeMethod = PaymentMethod.EFECTIVO;
    } else if (rawMethod.includes('MERCADO') || rawMethod.includes('MP')) {
      safeMethod = PaymentMethod.MERCADOPAGO;
    } else {
      safeMethod = PaymentMethod.YAPE;
    }

    // Calcular monto seguro numérico a pagar
    let safeAmount = Number(dto.amount ?? dto.monto);

    // Calcular precio total de la reserva
    let totalPrice = 0;
    if (typeof booking.pricing === 'object' && booking.pricing !== null) {
      totalPrice = Number((booking.pricing as any).totalPrice ?? (booking.pricing as any).basePrice);
    } else if (typeof booking.pricing === 'string') {
      try {
        const parsed = JSON.parse(booking.pricing);
        totalPrice = Number(parsed?.totalPrice ?? parsed?.basePrice);
      } catch {}
    }
    if (isNaN(totalPrice) || totalPrice <= 0) {
      const courtPrice = Number(booking.court?.priceDay || booking.court?.priceNight || 0);
      const dur = Number(booking.duration || 1);
      totalPrice = courtPrice * dur * 2;
    }

    if (isNaN(safeAmount) || safeAmount <= 0) {
      safeAmount = totalPrice > 0 ? totalPrice : 0;
    }

    // Parse safe type
    const rawType = (dto.type || dto.tipo || '').toString().toUpperCase();
    let safeType: PaymentType = PaymentType.PAGO_COMPLETO;
    if (rawType.includes('SALDO')) {
      safeType = PaymentType.SALDO;
    } else if (rawType.includes('ADELANTO') || (totalPrice > 0 && safeAmount < totalPrice - 0.01)) {
      safeType = PaymentType.ADELANTO;
    } else {
      safeType = PaymentType.PAGO_COMPLETO;
    }

    if (isNaN(safeAmount) || safeAmount < 0) {
      safeAmount = 0;
    }

    const isSaldoPayment = safeType === PaymentType.SALDO || rawType.includes('SALDO');

    let savedPayment: Payment;
    const existing = booking.payment || await this.paymentRepo.findOne({
      where: { bookings: { id: dto.bookingId } },
      relations: ['bookings', 'user'],
    });

    if (isSaldoPayment) {
      if (existing) {
        const normSaldo = String(existing.saldoStatus || '').toUpperCase().trim();
        if (normSaldo === 'PAGADO' || normSaldo === 'PAID') {
          throw new BadRequestException('El saldo de esta reserva ya ha sido cancelado y aprobado por el club.');
        }

        // Es la cancelación o comprobante del saldo restante (2do pago)
        existing.saldoAmount = safeAmount;
        existing.saldoMethod = safeMethod;
        existing.saldoComprobanteUrl = dto.comprobanteUrl;
        existing.saldoStatus = 'PENDIENTE';
        existing.saldoNotas = 'Comprobante de saldo enviado por el cliente';
        existing.saldoFechaConfirmacion = new Date();
        savedPayment = await this.paymentRepo.save(existing);
      } else {
        // En caso improbable de no contar con un pago previo registrado
        const payment = this.paymentRepo.create({
          bookings: [booking],
          user,
          amount: safeAmount,
          currency: dto.currency || 'PEN',
          method: safeMethod,
          paymentMethod: safeMethod,
          status: PaymentStatus.PENDING,
          type: PaymentType.SALDO,
          saldoStatus: 'PENDIENTE',
          saldoAmount: safeAmount,
          saldoMethod: safeMethod,
          saldoComprobanteUrl: dto.comprobanteUrl,
          comprobanteUrl: dto.comprobanteUrl,
          pendingAudit: true,
          autoConfirmed: false,
        });
        savedPayment = await this.paymentRepo.save(payment);
      }
    } else {
      // Flujo de Pago Inicial (Adelanto o Pago Completo)
      if (existing && existing.status !== PaymentStatus.REJECTED) {
        if (existing.status === PaymentStatus.PAID) {
          throw new BadRequestException('Esta reserva ya tiene un pago aprobado.');
        }
        // Si está pendiente y el usuario re-envía comprobante para corregirlo
        if (dto.comprobanteUrl) {
          existing.amount = safeAmount;
          existing.method = safeMethod;
          existing.paymentMethod = safeMethod;
          existing.status = PaymentStatus.PENDING;
          existing.type = safeType;
          existing.comprobanteUrl = dto.comprobanteUrl;
          existing.pendingAudit = true;
          existing.autoConfirmed = false;
          savedPayment = await this.paymentRepo.save(existing);
        } else {
          return {
            message: 'Esta reserva ya cuenta con un pago en proceso.',
            payment: existing,
          };
        }
      } else if (existing && existing.status === PaymentStatus.REJECTED) {
        // Actualización tras rechazo previo
        existing.amount = safeAmount;
        existing.method = safeMethod;
        existing.paymentMethod = safeMethod;
        existing.status = PaymentStatus.PENDING;
        existing.type = safeType;
        existing.comprobanteUrl = dto.comprobanteUrl;
        existing.pendingAudit = true;
        existing.autoConfirmed = false;
        existing.motivoRechazo = undefined;
        savedPayment = await this.paymentRepo.save(existing);
      } else {
        // Crear nuevo pago inicial
        const payment = this.paymentRepo.create({
          bookings: [booking],
          user,
          amount: safeAmount,
          currency: dto.currency || 'PEN',
          method: safeMethod,
          paymentMethod: safeMethod,
          status: PaymentStatus.PENDING,
          type: safeType,
          saldoStatus: safeType === PaymentType.PAGO_COMPLETO ? 'NO_APLICA' : 'PENDIENTE',
          saldoAmount: 0,
          comprobanteUrl: dto.comprobanteUrl,
          pendingAudit: true,
          autoConfirmed: false,
        });
        savedPayment = await this.paymentRepo.save(payment);
      }
    }

    // Actualizar estado de la reserva
    booking.payment = savedPayment;
    booking.paymentMethod = 'manual';
    if (!isSaldoPayment) {
      booking.paymentStatus = PaymentStatus.PENDING;
      if (dto.comprobanteUrl) {
        booking.proofOfPaymentUrl = dto.comprobanteUrl;
      }
    }
    await this.bookingRepo.save(booking);

    // Inyectar al Libro de Transacciones
    this.transactionsService.recordVoucherSubmitted(savedPayment, booking, isSaldoPayment).catch(() => {});

    // Retener slots en calendario
    if (booking.court && booking.court.id && booking.date && booking.startTime) {
      try {
        await this.generateSlotOccupied(
          booking.court.id,
          booking.date,
          booking.startTime,
          Number(booking.duration) || 1,
        );
      } catch (e) {
        console.warn('Error al retener slots:', e);
      }
    }

    // Disparar notificaciones por correo al Club y al Usuario (sin bloquear el response)
    try {
      const fullBooking = await this.bookingService.findOneComplete(booking.id);
      const targetBooking = fullBooking || booking;
      await this.mailerService.sendPaymentReceiptUploadedClubNotificationEmail(targetBooking, savedPayment);
      await this.mailerService.sendPaymentReceiptUploadedUserNotificationEmail(targetBooking, savedPayment);
    } catch (mailErr: any) {
      console.warn('⚠️ Error al enviar correos de auditoría de pago:', mailErr?.message);
    }

    return {
      message: safeType === PaymentType.SALDO 
        ? 'Comprobante de saldo restante enviado exitosamente. El club validará tu pago.'
        : 'Comprobante registrado exitosamente. El club validará tu pago.',
      payment: savedPayment,
    };
  }

  /**
   * Obtener pagos asociados a una reserva
   */
  async getPaymentsByBooking(bookingId: string) {
    return this.paymentRepo.find({
      where: { bookings: { id: bookingId } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Helper para buscar un Payment por ID o buscar/crear un Payment a partir de un Booking ID
   */
  private async findOrCreatePaymentForAudit(paymentId: string): Promise<Payment> {
    let payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['bookings', 'bookings.user', 'bookings.court', 'bookings.club', 'user'],
    });
    if (!payment) {
      const booking = await this.bookingRepo.findOne({
        where: { id: paymentId },
        relations: ['court', 'court.club', 'club', 'user', 'payment'],
      });
      if (booking) {
        if (booking.payment) {
          payment = await this.paymentRepo.findOne({
            where: { id: booking.payment.id },
            relations: ['bookings', 'bookings.user', 'bookings.court', 'bookings.club', 'user'],
          });
        }
        if (!payment) {
          let totalPrice = 0;
          if (booking.pricing && typeof booking.pricing === 'object') {
            totalPrice = Number((booking.pricing as any).totalPrice ?? (booking.pricing as any).basePrice ?? 0);
          }
          if (isNaN(totalPrice) || totalPrice <= 0) {
            const courtPrice = Number(booking.court?.priceDay || booking.court?.priceNight || 0);
            const dur = Number(booking.duration || 1);
            totalPrice = courtPrice * dur * 2;
          }

          let safeMethod: PaymentMethod = PaymentMethod.EFECTIVO;
          const bMeth = (booking.paymentMethod || '').toUpperCase();
          if (bMeth.includes('YAPE')) safeMethod = PaymentMethod.YAPE;
          else if (bMeth.includes('PLIN')) safeMethod = PaymentMethod.PLIN;
          else if (bMeth.includes('MERCADO') || bMeth.includes('MP')) safeMethod = PaymentMethod.MERCADOPAGO;
          else if (bMeth.includes('TRANSFER')) safeMethod = PaymentMethod.TRANSFERENCIA;
          else if (bMeth.includes('WHATSAPP')) safeMethod = PaymentMethod.WHATSAPP;

          const newPayment = this.paymentRepo.create({
            bookings: [booking],
            user: booking.user,
            amount: totalPrice,
            currency: 'PEN',
            method: safeMethod,
            status: PaymentStatus.PENDING,
            type: PaymentType.PAGO_COMPLETO,
            saldoStatus: 'NO_APLICA',
            pendingAudit: Boolean(booking.proofOfPaymentUrl),
            comprobanteUrl: booking.proofOfPaymentUrl || undefined,
            autoConfirmed: false,
          });
          const saved = await this.paymentRepo.save(newPayment);
          booking.payment = saved;
          await this.bookingRepo.save(booking);

          payment = await this.paymentRepo.findOne({
            where: { id: saved.id },
            relations: ['bookings', 'bookings.user', 'bookings.court', 'user'],
          });
        }
      }
    }
    return payment;
  }

  /**
   * Auditar un pago manual: CONFIRMAR o RECHAZAR el comprobante subido por el usuario.
   * Actualiza el estado del pago y dispara notificaciones si aplica.
   */
  async auditManualPayment(
    paymentId: string,
    action: 'CONFIRMAR' | 'RECHAZAR',
    auditor: User,
    motivoRechazo?: string,
  ) {
    const payment = await this.findOrCreatePaymentForAudit(paymentId);
    if (!payment) throw new BadRequestException('Pago o reserva no encontrada');

    if (auditor.role !== UserRole.ADMIN) {
      const auditorClub = await this.clubsService.findClubByUser(auditor).catch(() => null);
      if (!auditorClub) {
        throw new ForbiddenException('No tienes permisos para auditar pagos (no perteneces a ningún club)');
      }
      const paymentClubId = payment.bookings?.[0]?.club?.id || payment.bookings?.[0]?.court?.club?.id;
      if (!paymentClubId || paymentClubId !== auditorClub.id) {
        throw new ForbiddenException('No tienes permisos para auditar pagos de otro club');
      }
    }

    if (action === 'CONFIRMAR') {
      payment.status = PaymentStatus.PAID;
      payment.pendingAudit = false;
      payment.fechaConfirmacion = new Date();
      payment.confirmadoPor = auditor;
      payment.motivoRechazo = null;

      const firstBooking = payment.bookings?.[0];
      let totalPrice = 0;
      if (firstBooking && typeof firstBooking.pricing === 'object' && firstBooking.pricing !== null) {
        totalPrice = Number((firstBooking.pricing as any).totalPrice ?? (firstBooking.pricing as any).basePrice);
      }
      if (isNaN(totalPrice) || totalPrice <= 0) {
        totalPrice = Number(payment.amount || 0);
      }

      if (payment.type === PaymentType.PAGO_COMPLETO || Number(payment.amount || 0) >= totalPrice - 0.05) {
        payment.type = PaymentType.PAGO_COMPLETO;
        payment.saldoStatus = 'NO_APLICA';
        payment.saldoAmount = 0;
      } else if (payment.type === PaymentType.ADELANTO && (!payment.saldoStatus || payment.saldoStatus === 'NO_APLICA')) {
        payment.saldoStatus = 'PENDIENTE';
      }

      // Confirmar reserva asociada
      if (payment.bookings && payment.bookings.length > 0) {
        for (let b of payment.bookings) {
          b.status = BookingStatus.CONFIRMED;
          b.pendingAudit = false;

          if (payment.type === PaymentType.PAGO_COMPLETO || payment.saldoStatus === 'PAGADO') {
            b.paymentStatus = PaymentStatus.PAID;
          } else if (payment.type === PaymentType.ADELANTO && payment.saldoStatus !== 'PAGADO') {
            b.paymentStatus = PaymentStatus.PENDING;
          }
          await this.bookingRepo.save(b);

          if (b.court && b.date && b.startTime) {
            try {
              await this.generateSlotOccupied(
                b.court.id,
                b.date,
                b.startTime,
                Number(b.duration) || 1,
              );
            } catch (e) {
              console.warn('Error al ocupar slots:', e);
            }
          }
        }
      }
    } else {
      payment.status = PaymentStatus.REJECTED;
      payment.pendingAudit = false;
      payment.fechaConfirmacion = new Date();
      payment.confirmadoPor = auditor;
      payment.motivoRechazo = motivoRechazo || null;
      payment.saldoStatus = 'NO_APLICA';

      if (payment.bookings && payment.bookings.length > 0) {
        for (let b of payment.bookings) {
          b.paymentStatus = PaymentStatus.REJECTED;
          b.status = BookingStatus.CANCELLED;
          b.pendingAudit = false;
          await this.bookingRepo.save(b);

          // Liberar los slots ocupados
          try {
            const rawDate: any = b.date;
            const dateStr = typeof rawDate === 'string' ? rawDate.substring(0, 10) : new Date(rawDate).toISOString().substring(0, 10);
            const times = this.generateTimeSlots(b.startTime, Number(b.duration) || 1);
            const payload = times.map((t) => ({
              courtId: b.court.id,
              date: dateStr,
              time: t,
              status: 'available',
            }));
            await this.scheduleTemplateService.bulkUpdate(payload as any);
          } catch (e) {
            console.warn('Error al liberar slots:', e);
          }
        }
      }
    }

    const saved = await this.paymentRepo.save(payment);

    // Inyectar al Libro de Transacciones (Audit Voucher)
    if (saved.bookings && saved.bookings.length > 0) {
      this.transactionsService.recordVoucherReviewed(saved, action, auditor.id, saved.bookings[0], false).catch(() => {});
    }

    // Disparar notificaciones por correo de auditoría finalizada (sin bloquear el response)
    try {
      if (saved.bookings && saved.bookings.length > 0) {
        for (const b of saved.bookings) {
          const fullBooking = await this.bookingService.findOneComplete(b.id);
          const targetBooking = fullBooking || b;

          if (action === 'CONFIRMAR') {
            await this.mailerService.sendBookingPaidNotifications(targetBooking);
          } else {
            const userEmail = this.mailerService.getUserTargetEmail(targetBooking);
            if (userEmail) {
              await this.mailerService.sendBookingCancelledEmail(
                userEmail,
                targetBooking,
                motivoRechazo || 'Comprobante de pago rechazado tras auditoría del club',
              );
            }
          }
        }
      }
    } catch (mailErr: any) {
      console.warn('⚠️ Error al enviar correos tras auditoría de pago:', mailErr?.message);
    }

    return {
      status: saved.status,
      message: action === 'CONFIRMAR' ? 'Pago confirmado exitosamente' : 'Pago rechazado',
      payment: saved,
    };
  }

  /**
   * Auditar el comprobante de saldo restante subido por el usuario.
   * CONFIRMAR → saldoStatus = PAGADO, si el pago inicial también está confirmado → PAGO COMPLETO
   * RECHAZAR → saldoStatus = RECHAZADO, el usuario deberá re-enviar
   */
  async auditSaldoComprobante(
    paymentId: string,
    action: 'CONFIRMAR' | 'RECHAZAR',
    auditor: User,
    motivoRechazo?: string,
  ) {
    const payment = await this.findOrCreatePaymentForAudit(paymentId);
    if (!payment) throw new BadRequestException('Pago o reserva no encontrada');

    if (auditor.role !== UserRole.ADMIN) {
      const auditorClub = await this.clubsService.findClubByUser(auditor).catch(() => null);
      if (!auditorClub) {
        throw new ForbiddenException('No tienes permisos para auditar saldos (no perteneces a ningún club)');
      }
      const paymentClubId = payment.bookings?.[0]?.club?.id || payment.bookings?.[0]?.court?.club?.id;
      if (!paymentClubId || paymentClubId !== auditorClub.id) {
        throw new ForbiddenException('No tienes permisos para auditar saldos de otro club');
      }
    }

    if (action === 'CONFIRMAR') {
      payment.saldoStatus = 'PAGADO';
      payment.saldoConfirmadoPor = auditor;
      payment.saldoFechaConfirmacion = new Date();

      // Si el comprobante inicial ya fue aprobado → pago completo
      const initialConfirmed =
        payment.status === PaymentStatus.PAID ||
        String(payment.status).toUpperCase() === 'CONFIRMADO' ||
        String(payment.status).toUpperCase() === 'CONFIRMED';

      if (payment.bookings && payment.bookings.length > 0) {
        if (initialConfirmed) {
          // Ambos pagos confirmados → PAGO COMPLETO
          for (let b of payment.bookings) {
            b.paymentStatus = PaymentStatus.PAID;
            if (b.status !== BookingStatus.CONFIRMED) {
              b.status = BookingStatus.CONFIRMED;
            }
            await this.bookingRepo.save(b);
          }
        }
      }
    } else {
      // RECHAZAR
      payment.saldoStatus = 'RECHAZADO';
      payment.saldoNotas = motivoRechazo || 'Comprobante de saldo rechazado por el club';
      payment.saldoFechaConfirmacion = new Date();
      payment.saldoConfirmadoPor = auditor;
    }

    const saved = await this.paymentRepo.save(payment);

    // Inyectar al Libro de Transacciones (Audit Voucher Saldo)
    if (saved.bookings && saved.bookings.length > 0) {
      this.transactionsService.recordVoucherReviewed(saved, action, auditor.id, saved.bookings[0], true).catch(() => {});
    }
    return {
      status: saved.saldoStatus,
      message: action === 'CONFIRMAR'
        ? 'Comprobante de saldo confirmado exitosamente'
        : 'Comprobante de saldo rechazado',
      payment: saved,
    };
  }

  /**
   * Confirmar la liquidación / cobro del saldo restante de una reserva con adelanto
   */
  async settleManualSaldo(
    paymentId: string,
    dto: {
      monto?: number;
      metodo?: string;
      comprobanteUrl?: string;
      notas?: string;
      posCommission?: number;
    },
    auditor: User,
  ) {
    const payment = await this.findOrCreatePaymentForAudit(paymentId);
    if (!payment) throw new BadRequestException('Pago o reserva no encontrada');

    if (auditor.role !== UserRole.ADMIN) {
      const auditorClub = await this.clubsService.findClubByUser(auditor).catch(() => null);
      if (!auditorClub) {
        throw new ForbiddenException('No tienes permisos para liquidar saldos (no perteneces a ningún club)');
      }
      const paymentClubId = payment.bookings?.[0]?.club?.id || payment.bookings?.[0]?.court?.club?.id;
      if (!paymentClubId || paymentClubId !== auditorClub.id) {
        throw new ForbiddenException('No tienes permisos para liquidar saldos de otro club');
      }
    }

    const firstBooking = payment.bookings?.[0];

    // Calcular precio total de la reserva
    let totalPrice = 0;
    if (firstBooking && typeof firstBooking.pricing === 'object' && firstBooking.pricing !== null) {
      totalPrice = Number((firstBooking.pricing as any).totalPrice ?? (firstBooking.pricing as any).basePrice);
    } else if (firstBooking && typeof firstBooking.pricing === 'string') {
      try {
        const parsed = JSON.parse(firstBooking.pricing);
        totalPrice = Number(parsed?.totalPrice ?? parsed?.basePrice);
      } catch {}
    }
    if (isNaN(totalPrice) || totalPrice <= 0) {
      const courtPrice = Number(firstBooking?.court?.priceDay || firstBooking?.court?.priceNight || 0);
      const dur = Number(firstBooking?.duration || 1);
      totalPrice = courtPrice * dur * 2;
    }
    if (isNaN(totalPrice) || totalPrice <= 0) {
      totalPrice = Number(payment.amount || 0);
    }

    const initialAmount = Number(payment.amount || 0);
    const calculatedRemaining = Math.max(0, Number((totalPrice - initialAmount).toFixed(2)));
    const settleAmount = Number(dto.monto != null ? dto.monto : calculatedRemaining);

    // Si el comprobante inicial estaba pendiente, se auto-valida al momento de liquidar
    if (payment.status === PaymentStatus.PENDING || (payment.status as string) === 'PENDIENTE') {
      payment.status = PaymentStatus.PAID;
      payment.fechaConfirmacion = new Date();
      payment.confirmadoPor = auditor;
    }

    // Normalizar método de saldo
    const rawMethod = (dto.metodo || 'EFECTIVO').toString().toUpperCase();
    let safeMethod = 'EFECTIVO';
    if (rawMethod.includes('YAPE')) safeMethod = 'YAPE';
    else if (rawMethod.includes('PLIN')) safeMethod = 'PLIN';
    else if (rawMethod.includes('TRANSFER')) safeMethod = 'TRANSFERENCIA';
    else if (rawMethod.includes('CARD') || rawMethod.includes('POS') || rawMethod.includes('TARJETA')) safeMethod = 'CARD';
    else if (rawMethod.includes('MERCADO')) safeMethod = 'MERCADOPAGO';
    else safeMethod = 'EFECTIVO';

    // Compute fee if POS/CARD and commission provided
    let feeAmount = 0;
    let netAmount = settleAmount;
    if (safeMethod === 'CARD' && dto.posCommission && dto.posCommission > 0) {
      feeAmount = Number(((settleAmount * dto.posCommission) / 100).toFixed(2));
      netAmount = Number((settleAmount - feeAmount).toFixed(2));
    }

    payment.saldoStatus = 'PAGADO';
    payment.saldoAmount = settleAmount;
    payment.saldoFeeAmount = feeAmount;
    payment.saldoNetAmount = netAmount;
    payment.saldoMethod = safeMethod;
    payment.saldoComprobanteUrl = dto.comprobanteUrl || null;
    payment.saldoNotas = dto.notas || null;
    payment.saldoFechaConfirmacion = new Date();
    payment.saldoConfirmadoPor = auditor;

    // Actualizar estado de la reserva
    if (payment.bookings && payment.bookings.length > 0) {
      for (let b of payment.bookings) {
        b.status = BookingStatus.CONFIRMED;
        b.paymentStatus = PaymentStatus.PAID;
        await this.bookingRepo.save(b);
      }
    }

    const saved = await this.paymentRepo.save(payment);

    // Inyectar al Libro de Transacciones (Saldo)
    if (saved.bookings && saved.bookings.length > 0) {
      this.transactionsService.recordBalancePayment(saved, saved.bookings[0], auditor.id).catch(() => {});
    }

    return {
      status: 'PAGADO',
      message: 'Saldo restante liquidado y registrado exitosamente',
      payment: saved,
    };
  }
}
