import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingCronService } from './booking-cron.service';
import { Booking } from './booking.entity';
import { BookingStatus } from './booking-status.enum';
import { Payment } from '../payment/payment.entity';
import { PaymentStatus } from '../payment/payment-status.enum';
import { ScheduleTemplateService } from '../schedule/schedule-template.service';
import { MailerService } from '../mailer/mailer.service';
import { subHours, subMinutes, addHours } from 'date-fns';

describe('BookingCronService - Auto Cancellation & Auto Confirmation Lifecycle', () => {
  let service: BookingCronService;
  let bookingRepo: any;
  let paymentRepo: any;
  let scheduleTemplateService: any;
  let mailerService: any;

  const mockBookingRepo = {
    find: jest.fn(),
    save: jest.fn((b) => Promise.resolve(b)),
  };

  const mockPaymentRepo = {
    save: jest.fn((p) => Promise.resolve(p)),
  };

  const mockScheduleTemplateService = {
    bulkUpdate: jest.fn().mockResolvedValue(true),
  };

  const mockMailerService = {
    sendBookingExpiredUnpaidEmail: jest.fn().mockResolvedValue(true),
    sendBookingAutoConfirmedPendingAuditEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCronService,
        {
          provide: getRepositoryToken(Booking),
          useValue: mockBookingRepo,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: ScheduleTemplateService,
          useValue: mockScheduleTemplateService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<BookingCronService>(BookingCronService);
    bookingRepo = module.get(getRepositoryToken(Booking));
    paymentRepo = module.get(getRepositoryToken(Payment));
    scheduleTemplateService = module.get(ScheduleTemplateService);
    mailerService = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1) Auto-Cancelación: Reservó pero NO subió comprobante (> 15 minutos)', () => {
    it('debe cancelar la reserva, liberar los slots y enviar correo de expiración', async () => {
      const now = new Date();
      const expiredUnpaidBooking: Partial<Booking> = {
        id: 'booking-unpaid-1',
        bookingReference: 'REF-UNPAID-1',
        status: BookingStatus.PENDING,
        createdAt: subMinutes(now, 20),
        date: new Date('2026-08-25'),
        startTime: '18:00',
        endTime: '19:00',
        duration: 1,
        court: { id: 'court-1' } as any,
        customerInfo: { name: 'Carlos López', email: 'carlos@test.com', phone: '999888777' },
        autoCancelled: false,
        autoConfirmed: false,
        proofOfPaymentUrl: undefined,
        payment: undefined,
      };

      mockBookingRepo.find.mockResolvedValueOnce([expiredUnpaidBooking]);

      await service.handleUnpaidBookingsAutoCancellation();

      expect(expiredUnpaidBooking.status).toBe(BookingStatus.CANCELLED);
      expect(expiredUnpaidBooking.autoCancelled).toBe(true);
      expect(expiredUnpaidBooking.cancellationReason).toContain('15 minutos excedido sin comprobante');
      expect(mockBookingRepo.save).toHaveBeenCalledWith(expiredUnpaidBooking);

      // Verifica que se liberaron los slots (available)
      expect(mockScheduleTemplateService.bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ courtId: 'court-1', status: 'available' }),
        ]),
      );

      // Verifica notificación por email
      expect(mockMailerService.sendBookingExpiredUnpaidEmail).toHaveBeenCalledWith(
        'carlos@test.com',
        expiredUnpaidBooking,
      );
    });

    it('NO debe cancelar si la reserva tiene comprobante subido (será procesada para auto-confirmación)', async () => {
      const now = new Date();
      const bookingWithVoucher: Partial<Booking> = {
        id: 'booking-voucher-1',
        status: BookingStatus.PENDING,
        createdAt: subHours(now, 3),
        autoCancelled: false,
        autoConfirmed: false,
        proofOfPaymentUrl: 'https://storage.com/voucher.jpg',
      };

      mockBookingRepo.find.mockResolvedValueOnce([bookingWithVoucher]);

      await service.handleUnpaidBookingsAutoCancellation();

      // No se modifica ni se cancela
      expect(bookingWithVoucher.status).toBe(BookingStatus.PENDING);
      expect(mockScheduleTemplateService.bulkUpdate).not.toHaveBeenCalled();
    });

    it('NO debe cancelar a los 15 minutos si la reserva es por método WhatsApp (tiene tolerancia de 2 horas)', async () => {
      const now = new Date();
      const whatsappBooking: Partial<Booking> = {
        id: 'booking-wa-1',
        paymentMethod: 'whatsapp',
        status: BookingStatus.PENDING,
        createdAt: subMinutes(now, 20),
        autoCancelled: false,
        autoConfirmed: false,
      };

      mockBookingRepo.find.mockResolvedValueOnce([whatsappBooking]);

      await service.handleUnpaidBookingsAutoCancellation();

      // No se cancela en el ciclo de 15 minutos
      expect(whatsappBooking.status).toBe(BookingStatus.PENDING);
      expect(mockBookingRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('2) Auto-Cancelación: Reservó por "Solo WhatsApp" y pasaron > 2 horas sin confirmar por admin', () => {
    it('debe cancelar la reserva de WhatsApp, liberar los slots y registrar motivo de expiración', async () => {
      const now = new Date();
      const expiredWaBooking: Partial<Booking> = {
        id: 'booking-wa-expired',
        bookingReference: 'REF-WA-EXP-1',
        paymentMethod: 'whatsapp',
        status: BookingStatus.PENDING,
        createdAt: subHours(now, 3),
        date: new Date('2026-08-25'),
        startTime: '19:00',
        endTime: '20:00',
        duration: 1,
        court: { id: 'court-wa-1' } as any,
        customerInfo: { name: 'Mario Rossi', email: 'mario@test.com', phone: '998877665' },
        autoCancelled: false,
        autoConfirmed: false,
      };

      mockBookingRepo.find.mockResolvedValueOnce([expiredWaBooking]);

      await service.handleWhatsAppUnconfirmedBookingsAutoCancellation();

      expect(expiredWaBooking.status).toBe(BookingStatus.CANCELLED);
      expect(expiredWaBooking.autoCancelled).toBe(true);
      expect(expiredWaBooking.cancellationReason).toContain('coordinación por WhatsApp (2 horas) expirado');
      expect(mockBookingRepo.save).toHaveBeenCalledWith(expiredWaBooking);

      expect(mockScheduleTemplateService.bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ courtId: 'court-wa-1', status: 'available' }),
        ]),
      );
    });
  });

  describe('3) Auto-Confirmación: YA subió comprobante y pasaron > 2 horas sin auditar', () => {
    it('NO debe liberar la cancha; debe AUTO-CONFIRMARLA con pendingAudit=true y asegurar slots (occupied)', async () => {
      const now = new Date();
      const bookingWithVoucher: Partial<Booking> = {
        id: 'booking-voucher-2',
        bookingReference: 'REF-VOUCHER-2',
        status: BookingStatus.PENDING,
        createdAt: subHours(now, 3),
        date: new Date('2026-08-25'),
        startTime: '20:00',
        endTime: '21:00',
        duration: 1,
        court: { id: 'court-2' } as any,
        customerInfo: { name: 'Ana Torres', email: 'ana@test.com', phone: '999111222' },
        autoCancelled: false,
        autoConfirmed: false,
        proofOfPaymentUrl: 'https://supabase.co/voucher-plin.png',
        payment: {
          id: 'pay-1',
          autoConfirmed: false,
          pendingAudit: false,
        } as any,
      };

      mockBookingRepo.find.mockResolvedValueOnce([bookingWithVoucher]);

      await service.handleVoucherUploadedAutoConfirmation();

      // Confirmado y marcado para auditoría posterior
      expect(bookingWithVoucher.status).toBe(BookingStatus.CONFIRMED);
      expect(bookingWithVoucher.autoConfirmed).toBe(true);
      expect(bookingWithVoucher.pendingAudit).toBe(true);
      expect(bookingWithVoucher.payment.autoConfirmed).toBe(true);
      expect(bookingWithVoucher.payment.pendingAudit).toBe(true);

      expect(mockBookingRepo.save).toHaveBeenCalledWith(bookingWithVoucher);
      expect(mockPaymentRepo.save).toHaveBeenCalledWith(bookingWithVoucher.payment);

      // Asegura que la cancha quede ocupada
      expect(mockScheduleTemplateService.bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ courtId: 'court-2', status: 'occupied' }),
        ]),
      );

      // Envía email confirmando la reserva y asegurando la cancha
      expect(mockMailerService.sendBookingAutoConfirmedPendingAuditEmail).toHaveBeenCalledWith(
        'ana@test.com',
        bookingWithVoucher,
      );
    });
  });
});
