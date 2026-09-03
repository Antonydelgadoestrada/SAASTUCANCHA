import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { subHours, subMinutes, addMinutes, format, startOfDay } from 'date-fns';
import { Booking } from './booking.entity';
import { BookingStatus } from './booking-status.enum';
import { Payment } from '../payment/payment.entity';
import { PaymentStatus } from '../payment/payment-status.enum';
import { ScheduleTemplateService } from '../schedule/schedule-template.service';
import { MailerService } from '../mailer/mailer.service';

/**
 * Función auxiliar para calcular las franjas horarias de una reserva
 */
function generateTimeSlots(start: string, duration: number): string[] {
  const [hours, minutes] = start.split(':').map(Number);
  const startDate = new Date(2020, 0, 1, hours, minutes);
  const numberOfSlots = Math.round(duration * 2); // 0.5h = 30min por slot
  const slots: string[] = [];

  for (let i = 0; i < numberOfSlots; i++) {
    const slotTime = addMinutes(startDate, i * 30);
    slots.push(format(slotTime, 'HH:mm'));
  }

  return slots;
}

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly scheduleTemplateService: ScheduleTemplateService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Se ejecuta periódicamente cada 2 minutos para procesar reservas:
   * 1. Sin comprobante (Yape/Plin regular) -> Se auto-cancela a los 5 minutos y se liberan las canchas.
   * 2. "Solo WhatsApp" (en coordinación) -> Se auto-cancela a las 2 horas si el admin no confirma manualmente en el panel.
   * 3. Con comprobante subido -> Se auto-confirma a las 2 horas si el club no responde (cancha 100% asegurada).
   * 4. Recordatorio automático 30 minutos antes del turno para reducir inasistencias.
   */
  @Cron('*/2 * * * *')
  async handleBookingLifecycle() {
    this.logger.log('⏰ Ejecutando ciclo de reservas (Yape/Plin sin voucher > 5m, WhatsApp sin confirmar > 2h, Con voucher > 2h, Recordatorios 30m)...');
    await this.handleUnpaidBookingsAutoCancellation();
    await this.handleWhatsAppUnconfirmedBookingsAutoCancellation();
    await this.handleVoucherUploadedAutoConfirmation();
    await this.handleUpcomingBookingsReminders();
  }

  /**
   * 1) Reservó con método regular (Yape/Plin/Transferencia) pero AÚN NO subió comprobante y pasaron > 5 minutos:
   * Se auto-cancela la reserva y se liberan los horarios en la cancha.
   */
  async handleUnpaidBookingsAutoCancellation() {
    const fiveMinutesAgo = subMinutes(new Date(), 5);

    try {
      const pendingBookings = await this.bookingRepo.find({
        where: {
          status: BookingStatus.PENDING,
          createdAt: LessThan(fiveMinutesAgo),
          autoCancelled: false,
          autoConfirmed: false,
        },
        relations: ['court', 'club', 'user', 'payment'],
      });

      for (const booking of pendingBookings) {
        const isWhatsApp =
          booking.paymentMethod?.toLowerCase() === 'whatsapp' ||
          booking.payment?.method?.toLowerCase() === 'whatsapp';

        // Las reservas de "Solo WhatsApp" tienen tolerancia de 2 horas (las maneja handleWhatsAppUnconfirmedBookingsAutoCancellation)
        if (isWhatsApp) {
          continue;
        }

        const hasVoucher =
          Boolean(booking.proofOfPaymentUrl) ||
          Boolean(booking.payment?.comprobanteUrl) ||
          booking.payment?.status === PaymentStatus.PAID;

        // Si YA tiene comprobante, no lo cancelamos aquí
        if (hasVoucher) {
          continue;
        }

        this.logger.log(`⚠️ Cancelando reserva regular expirada sin comprobante (> 5 min): ${booking.bookingReference} (ID: ${booking.id})`);

        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellationReason = 'Cancelado automáticamente por falta de pago (tiempo límite de 5 minutos excedido sin comprobante)';
        booking.autoCancelled = true;
        booking.paymentStatus = PaymentStatus.FAILED;

        await this.bookingRepo.save(booking);

        // Liberar slots en el calendario de la cancha
        if (booking.court?.id && booking.date && booking.startTime && booking.duration) {
          const dateStr = format(new Date(booking.date), 'yyyy-MM-dd');
          const times = generateTimeSlots(booking.startTime, booking.duration);
          const slotsToRelease = times.map((t) => ({
            courtId: booking.court.id,
            date: dateStr,
            time: t,
            status: 'available',
          }));

          await this.scheduleTemplateService.bulkUpdate(slotsToRelease as any);
          this.logger.log(`🔓 ${slotsToRelease.length} slots liberados para cancha ${booking.court.id} fecha ${dateStr}`);
        }

        // Notificar al usuario por correo
        if (booking.customerInfo?.email || booking.user?.email) {
          const email = booking.customerInfo?.email || booking.user?.email;
          await this.mailerService.sendBookingExpiredUnpaidEmail(email, booking);
        }
      }
    } catch (err) {
      this.logger.error('Error al procesar auto-cancelación de reservas sin pago:', err?.message || err);
    }
  }

  /**
   * 2) Reservó con la opción "Solo WhatsApp" (horario bloqueado on-hold por 2 horas para coordinar con el club):
   * Si pasaron > 2 horas y el Administrador NO la confirmó manualmente desde su panel,
   * se libera el turno y se auto-cancela (nadie adjuntó comprobante).
   */
  async handleWhatsAppUnconfirmedBookingsAutoCancellation() {
    const twoHoursAgo = subHours(new Date(), 2);

    try {
      const pendingBookings = await this.bookingRepo.find({
        where: {
          status: BookingStatus.PENDING,
          createdAt: LessThan(twoHoursAgo),
          autoCancelled: false,
          autoConfirmed: false,
        },
        relations: ['court', 'club', 'user', 'payment'],
      });

      for (const booking of pendingBookings) {
        const isWhatsApp =
          booking.paymentMethod?.toLowerCase() === 'whatsapp' ||
          booking.payment?.method?.toLowerCase() === 'whatsapp';

        // Solo procesamos las reservas de WhatsApp
        if (!isWhatsApp) {
          continue;
        }

        const hasVoucher =
          Boolean(booking.proofOfPaymentUrl) ||
          Boolean(booking.payment?.comprobanteUrl) ||
          booking.payment?.status === PaymentStatus.PAID;

        // Si por alguna razón tuviera voucher o pago, no se auto-cancela
        if (hasVoucher) {
          continue;
        }

        this.logger.log(`⚠️ Cancelando reserva WhatsApp no confirmada por admin (> 2 horas): ${booking.bookingReference} (ID: ${booking.id})`);

        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellationReason = 'Cancelado automáticamente: tiempo límite de coordinación por WhatsApp (2 horas) expirado sin confirmación del administrador';
        booking.autoCancelled = true;
        booking.paymentStatus = PaymentStatus.FAILED;

        await this.bookingRepo.save(booking);

        // Liberar slots en el calendario de la cancha
        if (booking.court?.id && booking.date && booking.startTime && booking.duration) {
          const dateStr = format(new Date(booking.date), 'yyyy-MM-dd');
          const times = generateTimeSlots(booking.startTime, booking.duration);
          const slotsToRelease = times.map((t) => ({
            courtId: booking.court.id,
            date: dateStr,
            time: t,
            status: 'available',
          }));

          await this.scheduleTemplateService.bulkUpdate(slotsToRelease as any);
          this.logger.log(`🔓 ${slotsToRelease.length} slots liberados (WhatsApp expirado) para cancha ${booking.court.id} fecha ${dateStr}`);
        }

        // Notificar al usuario por correo
        if (booking.customerInfo?.email || booking.user?.email) {
          const email = booking.customerInfo?.email || booking.user?.email;
          await this.mailerService.sendBookingExpiredUnpaidEmail(email, booking);
        }
      }
    } catch (err) {
      this.logger.error('Error al procesar auto-cancelación de reservas WhatsApp:', err?.message || err);
    }
  }

  /**
   * 3) YA subió comprobante (Yape/Plin) y pasaron > 2 horas sin respuesta del admin del club:
   * NO se libera la cancha. El sistema la AUTO-CONFIRMA para asegurar el turno del cliente,
   * y queda marcada con "pendingAudit = true" para que el club la audite cuando pueda.
   */
  async handleVoucherUploadedAutoConfirmation() {
    const twoHoursAgo = subHours(new Date(), 2);

    try {
      const pendingWithVoucherBookings = await this.bookingRepo.find({
        where: {
          status: BookingStatus.PENDING,
          createdAt: LessThan(twoHoursAgo),
          autoConfirmed: false,
          autoCancelled: false,
        },
        relations: ['court', 'club', 'user', 'payment'],
      });

      for (const booking of pendingWithVoucherBookings) {
        const hasVoucher =
          Boolean(booking.proofOfPaymentUrl) ||
          Boolean(booking.payment?.comprobanteUrl);

        // Solo procesamos los que SÍ tienen comprobante cargado
        if (!hasVoucher) {
          continue;
        }

        this.logger.log(`🛡️ Auto-confirmando reserva con comprobante pendiente de auditoría: ${booking.bookingReference} (ID: ${booking.id})`);

        booking.status = BookingStatus.CONFIRMED;
        booking.autoConfirmed = true;
        booking.pendingAudit = true;

        if (booking.payment) {
          booking.payment.autoConfirmed = true;
          booking.payment.pendingAudit = true;
          await this.paymentRepo.save(booking.payment);
        }

        await this.bookingRepo.save(booking);

        // Asegurar que los slots queden marcados como ocupados
        if (booking.court?.id && booking.date && booking.startTime && booking.duration) {
          const dateStr = format(new Date(booking.date), 'yyyy-MM-dd');
          const times = generateTimeSlots(booking.startTime, booking.duration);
          const slotsToOccupy = times.map((t) => ({
            courtId: booking.court.id,
            date: dateStr,
            time: t,
            status: 'occupied',
          }));

          await this.scheduleTemplateService.bulkUpdate(slotsToOccupy as any);
          this.logger.log(`🔒 Cancha asegurada (occupied) para reserva ${booking.bookingReference}`);
        }

        // Notificar al usuario que su cancha está asegurada
        if (booking.customerInfo?.email || booking.user?.email) {
          const email = booking.customerInfo?.email || booking.user?.email;
          await this.mailerService.sendBookingAutoConfirmedPendingAuditEmail(email, booking);
        }
      }
    } catch (err) {
      this.logger.error('Error al procesar auto-confirmación de reservas con comprobante:', err?.message || err);
    }
  }

  /**
   * 4) Recordatorio automático 30-60 min antes del turno programado:
   * Busca reservas confirmadas para hoy cuyo partido inicie entre 15 y 65 minutos adelante,
   * envía el correo de recordatorio y marca reminderSent = true.
   */
  async handleUpcomingBookingsReminders() {
    try {
      const todayStart = startOfDay(new Date());

      const upcomingBookings = await this.bookingRepo.find({
        where: {
          status: BookingStatus.CONFIRMED,
          autoCancelled: false,
          reminderSent: false,
          date: MoreThanOrEqual(todayStart),
        },
        relations: ['court', 'club', 'user'],
      });

      const now = new Date();

      for (const booking of upcomingBookings) {
        if (!booking.startTime || !booking.date) {
          continue;
        }

        const dateObj = new Date(booking.date);
        const [hours, minutes] = (booking.startTime || '').split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
          continue;
        }

        // Construir fecha y hora del turno
        const matchStartTime = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          hours,
          minutes,
          0,
          0,
        );

        const diffMinutes = Math.round(
          (matchStartTime.getTime() - now.getTime()) / (1000 * 60),
        );

        // Ventana de recordatorio: entre 15 y 65 minutos antes del turno (ventana ideal de 30-60 min)
        if (diffMinutes >= 15 && diffMinutes <= 65) {
          const email = booking.customerInfo?.email || booking.user?.email;
          if (email) {
            this.logger.log(
              `🔔 Enviando recordatorio de partido a ${email} (Reserva: ${booking.bookingReference}, Inicio: ${booking.startTime}, en ${diffMinutes} min)`,
            );
            await this.mailerService.sendBookingReminderEmail(email, booking);
          }

          booking.reminderSent = true;
          booking.reminderSentAt = new Date();
          booking.notifiedAt = new Date();
          await this.bookingRepo.save(booking);
        }
      }
    } catch (err) {
      this.logger.error(
        'Error al procesar recordatorios automáticos de partidos:',
        err?.message || err,
      );
    }
  }
}
