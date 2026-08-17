import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentStatus } from './payment-status.enum';
import { BookingStatus } from '../booking/booking-status.enum';
import { BookingService } from '../booking/booking.service';
import { ClubService } from '../club/club.service';
import {MercadoPagoConfig, Preference, OAuth} from "mercadopago";
import {Payment as PaymentMp} from "mercadopago";
import { User } from '../user/user.entity';
import { CreateManualBookingDto } from '../booking/create-booking.dto';
import { addMinutes, addSeconds, isBefore, format} from 'date-fns'
import { PaymentMethod } from './payment-method.enum';
import { ScheduleTemplateService } from '../schedule/schedule-template.service';
import { MailerService } from '../mailer/mailer.service';
import { Booking } from '../booking/booking.entity';

@Injectable()
export class PaymentService {
  private mercadopago: MercadoPagoConfig; ;
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly bookingService: BookingService,
    private readonly clubsService: ClubService,
    private readonly scheduleTemplateService: ScheduleTemplateService,
    private readonly mailerService: MailerService,


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
 
  async handleOauthCallback(code: string, clubId) {
    // Obtenemos las credenciales del usuario usando el code que obtuvimos de oauth
    try{
      if (!process.env.MP_CLIENT_ID || !process.env.MP_CLIENT_SECRET || !code || !process.env.SERVICES_URL) {
        throw new Error(`Faltan valores requeridos para OAuth. ${process.env.MP_CLIENT_ID}`);
      }
      const credentials = await new OAuth(this.mercadopago).create({
        body: {
          client_id: process.env.MP_CLIENT_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.SERVICES_URL}/payments/oauth/callback`,
        },
      });
      const { access_token, refresh_token, user_id, expires_in} = credentials
      const tokenExpiresAt = addSeconds(new Date(), expires_in)
      await this.clubsService.updateClubWithMP(user_id, access_token, refresh_token, clubId, tokenExpiresAt)
      // Devolvemos las credenciales
      return {redirect: `${process.env.WEB_SERVICES_URL}/club/mercadopago`};
    }catch(error){
      throw new Error(`handleOauthCallback error ${error.response?.data || error.message || error}`)
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
   
  
}
