import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment, PaymentType } from './payment.entity';
import { PaymentStatus } from './payment-status.enum';
import { BookingStatus } from '../booking/booking-status.enum';
import { BookingService } from '../booking/booking.service';
import { ClubService } from '../club/club.service';
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

@Injectable()
export class PaymentService {
  private mercadopago: MercadoPagoConfig;
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly bookingService: BookingService,
    private readonly clubsService: ClubService,
    private readonly scheduleTemplateService: ScheduleTemplateService,
    private readonly mailerService: MailerService,
    private readonly s3Service: S3Service,
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
      const booking = await this.bookingService.createOnlineBooking(dto,user);
      return await this.confirmPreference(booking)
    }
    catch(error){
      throw new Error(`Error in createPreference, detail: ${error.message}`)
    }
  }
  
  async confirmPayment(dto: any){
    const booking = await this.bookingService.findOneComplete(dto.id);
    return await this.confirmPreference(booking)
  }

  async confirmPreference(booking:Booking){
    if (!booking.club || !booking.club.mpAccessToken) {
      throw new BadRequestException('El club no tiene Mercado Pago conectado');
    }
    const mpAccessToken = booking.club.mpAccessToken;
    const totalPrice = booking.pricing.totalPrice;
    const bookingId = booking.id;
    const email = booking.user.email;
    // 2. Crear una instancia temporal de MercadoPago con el token del club
    const client = new MercadoPagoConfig({
      accessToken: mpAccessToken,
    });
  
    // 3. Crear la preferencia de pago
    const preferenceClient = new Preference(client);
    const { init_point } = await preferenceClient.create({
      body: {
        items: [
          {
            id: booking.court.id,
            title: `Reserva en ${booking.court.name}`,
            description: `Club: ${booking.club.name} | fecha: ${booking.date} | Superficie: ${booking.court.surface} | Duracion: ${booking.startTime}-${booking.endTime}`,
            quantity: 1,
            category_id: 'services',
            currency_id: 'PEN',
            unit_price: totalPrice,
          },
        ],
        payer: {
          email: email,
        },
        metadata: {
          email
        },
        back_urls: {
          success: `${process.env.WEB_SERVICES_URL}/user/payments/success`,
          failure: `${process.env.WEB_SERVICES_URL}/user/payments/failure`,
          pending: `${process.env.WEB_SERVICES_URL}/user/payments/pending`,
        },
        // auto_return: 'approved',
        external_reference: `${bookingId}`,
        marketplace_fee: 5, // 💰 comisión
      },
    });
  
    // 4. Retornar el enlace
    return { init_point };
  }
  
  async handleMercadoPagoWebhook(query: any) {
    const { type, 'data.id': paymentId } = query;
  
    if (type !== 'payment' || !paymentId) {
      return;
    }

    try {
      // 1. Verificación rápida de idempotencia por transactionId existente
      const existingPayment = await this.paymentRepo.findOne({
        where: { transactionId: String(paymentId) },
        relations: ['booking'],
      });

      if (existingPayment && existingPayment.status === PaymentStatus.PAID) {
        console.log(`ℹ️ [Webhook Idempotente] El pago ${paymentId} ya fue procesado y aprobado previamente.`);
        return;
      }

      // 2. Obtener datos del pago desde la API de Mercado Pago
      const mpPayment = await new PaymentMp(this.mercadopago).get({ id: paymentId });
      const externalRef = mpPayment.external_reference;
      const status = mpPayment.status;
  
      if (!externalRef) {
        console.warn(`⚠️ Pago recibido sin external_reference, ID: ${paymentId}`);
        return;
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
      const updatedBooking = await this.paymentRepo.manager.transaction(async (trxManager) => {
        const booking = await this.bookingService.findOneComplete(externalRef);
        if (!booking) {
          console.warn(`Reserva no encontrada para referencia externa: ${externalRef}`);
          return null;
        }

        // Si ya está pagado por otra solicitud concurrente, abortar
        if (booking.paymentStatus === PaymentStatus.PAID && targetPaymentStatus === PaymentStatus.PAID) {
          console.log(`ℹ️ [Concurrencia] Reserva ${booking.id} ya marcada como PAID.`);
          return booking;
        }

        booking.paymentStatus = targetPaymentStatus;
        booking.status = targetBookingStatus;
        booking.pricing = {
          ...booking.pricing,
          basePrice: netoVendedor,
          totalPrice: totalPagado,
        };

        let paymentRecord = existingPayment || await trxManager.findOne(Payment, {
          where: { transactionId: String(mpPayment.id) },
        });

        if (paymentRecord) {
          paymentRecord.status = targetPaymentStatus;
          paymentRecord.amount = totalPagado;
          paymentRecord.netAmount = netoVendedor;
          paymentRecord.feeAmount = comisionMp + comisionApp;
          paymentRecord.paymentType = paymentType;
          paymentRecord.paymentMethod = paymentMethod;
          paymentRecord.gatewayResponse = mpPayment;
          await trxManager.save(Payment, paymentRecord);
        } else {
          paymentRecord = trxManager.create(Payment, {
            user: booking.user,
            booking,
            amount: totalPagado,
            currency: mpPayment.currency_id || 'PEN',
            method: mappedMethod,
            status: targetPaymentStatus,
            transactionId: String(mpPayment.id),
            netAmount: netoVendedor,
            feeAmount: comisionMp + comisionApp,
            paymentType,
            paymentMethod,
            gatewayResponse: mpPayment,
          });
          await trxManager.save(Payment, paymentRecord);
        }

        booking.payment = paymentRecord;
        await trxManager.save(Booking, booking);
        return booking;
      });

      if (!updatedBooking) {
        return;
      }
  
      // 5. Ocupar slots en calendario si el pago fue aprobado
      if (status === 'approved') {
        await this.generateSlotOccupied(
          updatedBooking.court.id,
          updatedBooking.date,
          updatedBooking.startTime,
          updatedBooking.duration
        );
      }
  
      // 6. Enviar correos informativos sin bloquear la respuesta del webhook
      try {
        if (correoAEnviar === 'pago_exitoso') {
          await this.mailerService.sendBookingPaidNotifications(updatedBooking);
        } else if (correoAEnviar === 'pago_rechazado') {
          await this.mailerService.sendBookingCancelledEmail(updatedBooking.customerInfo?.email || updatedBooking.user?.email, updatedBooking);
        }
      } catch (mailErr) {
        console.error(`⚠️ Error al enviar correos de confirmación: ${mailErr.message}`);
      }
  
      console.log(`✅ Webhook procesado correctamente con idempotencia para booking ${updatedBooking.id}`);
    } catch (error) {
      console.error(`Error al procesar webhook para ID ${paymentId}:`, error);
      throw error;
    }
  }

  // ─── MÉTRICAS DEL CLUB ─────────────────────────────────────────────────────

  async getClubPaymentMetrics(user: User, clubIdParam?: string) {
    const clubId = clubIdParam || user.club?.id;
    if (!clubId) {
      throw new BadRequestException('El usuario no tiene un club asociado');
    }

    const payments = await this.paymentRepo.find({
      where: { booking: { club: { id: clubId } } },
      relations: ['booking', 'booking.club', 'user'],
    });

    const bookings = await this.bookingRepo.find({
      where: { club: { id: clubId } },
    });

    let totalRecaudado = 0;
    let recaudadoMercadoPago = 0;
    let recaudadoYape = 0;
    let recaudadoPlin = 0;
    let recaudadoTransfer = 0;
    let recaudadoEfectivo = 0;
    let comprobantesPendientesCount = 0;
    let totalConfirmadosCount = 0;
    let totalRechazadosCount = 0;

    for (const p of payments) {
      const isConfirmed = p.status === PaymentStatus.PAID || (p.status as string) === 'CONFIRMADO';
      const isPending = p.status === PaymentStatus.PENDING || (p.status as string) === 'PENDIENTE';
      const isRejected = p.status === PaymentStatus.REJECTED || (p.status as string) === 'RECHAZADO';
      const amount = Number(p.amount) || 0;

      if (isConfirmed) {
        totalRecaudado += amount;
        totalConfirmadosCount++;
        if (p.method === PaymentMethod.YAPE) recaudadoYape += amount;
        else if (p.method === PaymentMethod.PLIN) recaudadoPlin += amount;
        else if ((p.method as string) === 'TRANSFERENCIA') recaudadoTransfer += amount;
        else if ((p.method as string) === 'EFECTIVO') recaudadoEfectivo += amount;
        else recaudadoMercadoPago += amount;
      } else if (isPending) {
        comprobantesPendientesCount++;
      } else if (isRejected) {
        totalRechazadosCount++;
      }
    }

    const recaudadoManual = recaudadoYape + recaudadoPlin + recaudadoTransfer + recaudadoEfectivo;
    const saldoPendienteTotal = bookings.reduce((sum, b) => sum + (Number((b as any).saldoPendiente) || 0), 0);

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

  // ─── LISTA DE PAGOS CON FILTROS ────────────────────────────────────────────

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
      .leftJoinAndSelect('payment.booking', 'booking')
      .leftJoinAndSelect('booking.court', 'court')
      .leftJoinAndSelect('booking.user', 'customer')
      .leftJoinAndSelect('payment.user', 'payer')
      .leftJoinAndSelect('payment.confirmadoPor', 'confirmadoPor')
      .orderBy('payment.createdAt', 'DESC');

    if (clubId) {
      query.where('booking.clubId = :clubId', { clubId });
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'pending') {
        query.andWhere('payment.status IN (:...ps)', { ps: ['PENDING', 'PENDIENTE'] });
      } else if (filters.status === 'confirmed' || filters.status === 'completed') {
        query.andWhere('payment.status IN (:...cs)', { cs: ['PAID', 'CONFIRMADO'] });
      } else if (filters.status === 'rejected') {
        query.andWhere('payment.status IN (:...rs)', { rs: ['REJECTED', 'RECHAZADO'] });
      }
    }

    if (filters.method && filters.method !== 'all') {
      query.andWhere('payment.method = :method', { method: filters.method });
    }

    if (filters.type && filters.type !== 'all') {
      query.andWhere('payment.type = :type', { type: filters.type });
    }

    const rawList = await query.getMany();

    if (filters.search) {
      const s = filters.search.toLowerCase();
      return rawList.filter((p) => {
        const ref = (p.booking as any)?.bookingReference?.toLowerCase() || '';
        const court = p.booking?.court?.name?.toLowerCase() || '';
        const name = (p.booking as any)?.customerInfo?.name?.toLowerCase() || (p.booking as any)?.user?.name?.toLowerCase() || '';
        const email = (p.booking as any)?.customerInfo?.email?.toLowerCase() || (p.booking as any)?.user?.email?.toLowerCase() || '';
        return ref.includes(s) || court.includes(s) || name.includes(s) || email.includes(s);
      });
    }

    return rawList;
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
    const dateStr = format(date, 'yyyy-MM-dd');
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

    // Parse safe type
    const rawType = (dto.type || dto.tipo || 'PAGO_COMPLETO').toString().toUpperCase();
    let safeType: PaymentType = PaymentType.PAGO_COMPLETO;
    if (rawType.includes('ADELANTO')) {
      safeType = PaymentType.ADELANTO;
    } else if (rawType.includes('SALDO')) {
      safeType = PaymentType.SALDO;
    } else {
      safeType = PaymentType.PAGO_COMPLETO;
    }

    // Calcular monto seguro numérico
    let safeAmount = Number(dto.amount ?? dto.monto);
    if (isNaN(safeAmount) || safeAmount <= 0) {
      if (typeof booking.pricing === 'object' && booking.pricing !== null) {
        safeAmount = Number(booking.pricing.totalPrice ?? booking.pricing.basePrice);
      } else if (typeof booking.pricing === 'string') {
        try {
          const parsed = JSON.parse(booking.pricing);
          safeAmount = Number(parsed?.totalPrice ?? parsed?.basePrice);
        } catch {}
      }
      if (isNaN(safeAmount) || safeAmount <= 0) {
        const courtPrice = Number(booking.court?.priceDay || booking.court?.priceNight || 0);
        const dur = Number(booking.duration || 1);
        safeAmount = courtPrice * dur * 2;
      }
    }
    if (isNaN(safeAmount) || safeAmount < 0) {
      safeAmount = 0;
    }

    const payment = this.paymentRepo.create({
      booking,
      user,
      amount: safeAmount,
      currency: dto.currency || 'PEN',
      method: safeMethod,
      paymentMethod: safeMethod,
      status: PaymentStatus.PENDING,
      type: safeType,
      comprobanteUrl: dto.comprobanteUrl,
      pendingAudit: true,
      autoConfirmed: false,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // Actualizar estado de la reserva a pendiente de verificación
    booking.payment = savedPayment;
    booking.paymentMethod = 'manual';
    booking.paymentStatus = PaymentStatus.PENDING;
    await this.bookingRepo.save(booking);

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

    return {
      message: 'Comprobante registrado exitosamente. El club validará tu pago.',
      payment: savedPayment,
    };
  }

  /**
   * Obtener pagos asociados a una reserva
   */
  async getPaymentsByBooking(bookingId: string) {
    return this.paymentRepo.find({
      where: { booking: { id: bookingId } },
      order: { createdAt: 'DESC' },
    });
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
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['booking', 'booking.user', 'booking.court', 'user'],
    });
    if (!payment) throw new BadRequestException('Pago no encontrado');

    if (action === 'CONFIRMAR') {
      payment.status = PaymentStatus.PAID;
      payment.fechaConfirmacion = new Date();
      payment.confirmadoPor = auditor;
      payment.motivoRechazo = null;

      // Confirmar reserva asociada
      if (payment.booking) {
        payment.booking.status = BookingStatus.CONFIRMED;
        payment.booking.paymentStatus = PaymentStatus.PAID;
        await this.bookingRepo.save(payment.booking);

        if (payment.booking.court && payment.booking.date && payment.booking.startTime) {
          try {
            await this.generateSlotOccupied(
              payment.booking.court.id,
              payment.booking.date,
              payment.booking.startTime,
              Number(payment.booking.duration) || 1,
            );
          } catch (e) {
            console.warn('Error al ocupar slots:', e);
          }
        }
      }
    } else {
      payment.status = PaymentStatus.REJECTED;
      payment.fechaConfirmacion = new Date();
      payment.confirmadoPor = auditor;
      payment.motivoRechazo = motivoRechazo || null;

      if (payment.booking) {
        payment.booking.paymentStatus = PaymentStatus.REJECTED;
        await this.bookingRepo.save(payment.booking);
      }
    }

    const saved = await this.paymentRepo.save(payment);

    return {
      status: saved.status,
      message: action === 'CONFIRMAR' ? 'Pago confirmado exitosamente' : 'Pago rechazado',
      payment: saved,
    };
  }
}
