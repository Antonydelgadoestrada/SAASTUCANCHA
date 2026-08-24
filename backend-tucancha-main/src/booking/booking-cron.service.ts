import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { subHours, addMinutes, format } from 'date-fns';
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
   * Se ejecuta periódicamente cada 5 minutos para procesar reservas pendientes de más de 2 horas.
   * Aplica la regla:
   * 1. Sin comprobante -> Se auto-cancela y se liberan las canchas (nadie perdió dinero).
   * 2. Con comprobante subido -> Se auto-confirma (cancha 100% asegurada) y queda marcada como "pendiente de auditar".
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleBookingLifecycle() {
    this.logger.log('⏰ Ejecutando ciclo de auto-cancelación / auto-confirmación de reservas (> 2 horas)...');
    await this.handleUnpaidBookingsAutoCancellation();
    await this.handleVoucherUploadedAutoConfirmation();
  }

  /**
   * 1) Reservó pero AÚN NO subió comprobante y pasaron > 2 horas:
   * Se auto-cancela la reserva y se liberan los horarios en la cancha.
   */
  async handleUnpaidBookingsAutoCancellation() {
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
        const hasVoucher =
          Boolean(booking.proofOfPaymentUrl) ||
          Boolean(booking.payment?.comprobanteUrl) ||
          booking.payment?.status === PaymentStatus.PAID;

        // Si YA tiene comprobante, este método NO lo cancela (lo atiende handleVoucherUploadedAutoConfirmation)
        if (hasVoucher) {
          continue;
        }

        this.logger.log(`⚠️ Cancelando reserva expirada sin comprobante: ${booking.bookingReference} (ID: ${booking.id})`);

        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellationReason = 'Cancelado automáticamente por falta de pago (tiempo límite de 2 horas excedido sin comprobante)';
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
   * 2) YA subió comprobante (Yape/Plin) y pasaron > 2 horas sin respuesta del admin del club:
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
}
