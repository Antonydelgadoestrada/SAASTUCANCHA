import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './payment.entity';
import { Booking } from '../booking/booking.entity';
import { PaymentStatus } from './payment-status.enum';
import { BookingStatus } from '../booking/booking-status.enum';
import { BookingService } from '../booking/booking.service';
import { ClubService } from '../club/club.service';
import { ScheduleTemplateService } from '../schedule/schedule-template.service';
import { MailerService } from '../mailer/mailer.service';

import { S3Service } from '../aws/s3.service';
import { PaymentMethod } from './payment-method.enum';
import { PaymentType } from './payment.entity';

// Mock MercadoPago
jest.mock('mercadopago', () => {
  return {
    MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
    Payment: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockResolvedValue({
        id: '123456789',
        external_reference: 'booking-uuid-1',
        status: 'approved',
        transaction_amount: 100,
        currency_id: 'PEN',
        payment_type_id: 'credit_card',
        payment_method_id: 'visa',
        transaction_details: { net_received_amount: 95 },
        fee_details: [{ type: 'mercadopago_fee', amount: 5 }],
      }),
    })),
    Preference: jest.fn(),
    OAuth: jest.fn(),
  };
});

describe('PaymentService - Booking Webhook & Voucher Upload Lifecycle', () => {
  let service: PaymentService;
  let paymentRepo: any;
  let bookingRepo: any;
  let bookingService: any;
  let mailerService: any;
  let scheduleTemplateService: any;
  let s3Service: any;

  const mockPaymentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...dto, id: 'payment-uuid' })),
    save: jest.fn((p) => Promise.resolve(p)),
    update: jest.fn(),
    delete: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((b) => Promise.resolve(b)),
  };

  const mockBookingService = {
    findOneComplete: jest.fn(),
    create: jest.fn(),
  };

  const mockClubService = {
    findAllWithToken: jest.fn(),
    update: jest.fn(),
  };

  const mockScheduleTemplateService = {
    bulkUpdate: jest.fn().mockResolvedValue([]),
    createBulk: jest.fn().mockResolvedValue([]),
    findSlots: jest.fn().mockResolvedValue([]),
  };

  const mockMailerService = {
    sendBookingPaidNotifications: jest.fn().mockResolvedValue(true),
    sendBookingCancelledEmail: jest.fn().mockResolvedValue(true),
    sendPaymentApprovedEmail: jest.fn().mockResolvedValue(true),
    sendPaymentRejectedEmail: jest.fn().mockResolvedValue(true),
    sendPaymentReceiptUploadedClubNotificationEmail: jest.fn().mockResolvedValue(true),
    sendPaymentReceiptUploadedUserNotificationEmail: jest.fn().mockResolvedValue(true),
  };

  const mockS3Service = {
    uploadFile: jest.fn().mockResolvedValue('https://s3.amazonaws.com/bucket/comprobante-123.png'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: mockBookingRepo,
        },
        {
          provide: BookingService,
          useValue: mockBookingService,
        },
        {
          provide: ClubService,
          useValue: mockClubService,
        },
        {
          provide: ScheduleTemplateService,
          useValue: mockScheduleTemplateService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    bookingRepo = module.get(getRepositoryToken(Booking));
    bookingService = module.get(BookingService);
    mailerService = module.get(MailerService);
    scheduleTemplateService = module.get(ScheduleTemplateService);
    s3Service = module.get(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1) Subida de Comprobante / Voucher (uploadReceiptFile)', () => {
    it('debe subir el archivo del voucher a S3 y retornar la URL', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-image-bytes'),
        originalname: 'voucher yape 123.jpg',
        mimetype: 'image/jpeg',
      };

      const result = await service.uploadReceiptFile(mockFile);

      expect(mockS3Service.uploadFile).toHaveBeenCalledWith(
        mockFile.buffer,
        'voucher_yape_123.jpg',
        'image/jpeg',
        'comprobantes-pago',
      );
      expect(result).toEqual({ url: 'https://s3.amazonaws.com/bucket/comprobante-123.png' });
    });

    it('debe arrojar error si el archivo no tiene buffer', async () => {
      await expect(service.uploadReceiptFile(null as any)).rejects.toThrow();
    });
  });

  describe('2) Registro de Pago con Comprobante (createBookingManualPayment)', () => {
    it('debe registrar el pago con comprobante, marcar pendingAudit=true y guardar proofOfPaymentUrl en booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        bookingReference: 'REF-BOOKING-1',
        paymentStatus: PaymentStatus.PENDING,
        court: { id: 'court-1', priceDay: 50 },
        date: new Date('2026-08-30'),
        startTime: '18:00',
        duration: 1,
        user: { id: 'user-1', email: 'jugador@test.com' },
        pricing: { totalPrice: 50 },
      };

      mockBookingService.findOneComplete.mockResolvedValue(mockBooking);

      const dto = {
        bookingId: 'booking-1',
        method: PaymentMethod.YAPE,
        type: PaymentType.PAGO_COMPLETO,
        amount: 50,
        comprobanteUrl: 'https://s3.amazonaws.com/bucket/comprobante-123.png',
      };

      const result = await service.createBookingManualPayment(dto as any, mockBooking.user as any);

      expect(result.message).toContain('Comprobante registrado exitosamente');
      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          method: PaymentMethod.YAPE,
          comprobanteUrl: 'https://s3.amazonaws.com/bucket/comprobante-123.png',
          pendingAudit: true,
          status: PaymentStatus.PENDING,
        }),
      );
      expect(mockBookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          proofOfPaymentUrl: 'https://s3.amazonaws.com/bucket/comprobante-123.png',
          paymentStatus: PaymentStatus.PENDING,
        }),
      );
    });
  });

  describe('3) Auditoría de Comprobante por Admin (auditManualPayment)', () => {
    it('debe confirmar el pago, liquidar auditoría y notificar al cliente cuando action=CONFIRMAR', async () => {
      const mockBookingItem = {
        id: 'booking-1',
        status: BookingStatus.PENDING,
        user: { email: 'jugador@test.com' },
      };
      const mockPayment = {
        id: 'pay-1',
        status: PaymentStatus.PENDING,
        pendingAudit: true,
        type: PaymentType.PAGO_COMPLETO,
        bookings: [mockBookingItem],
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.auditManualPayment('pay-1', 'CONFIRMAR', { role: 'ADMIN' } as any);

      expect(mockPayment.status).toBe(PaymentStatus.PAID);
      expect(mockPayment.pendingAudit).toBe(false);
      expect(mockBookingItem.status).toBe(BookingStatus.CONFIRMED);
      expect(mockPaymentRepo.save).toHaveBeenCalledWith(mockPayment);
    });
  });

  describe('4) Registro de Comprobante de Saldo Restante (createBookingManualPayment con SALDO)', () => {
    it('debe permitir registrar el comprobante del 2do pago aun cuando el pago inicial ya fue aprobado (PAID)', async () => {
      const mockExistingPayment: any = {
        id: 'payment-1',
        status: PaymentStatus.PAID,
        type: PaymentType.ADELANTO,
        amount: 60,
        saldoStatus: 'PENDIENTE',
        saldoAmount: 0,
        saldoComprobanteUrl: undefined,
      };

      const mockBooking = {
        id: 'booking-1',
        bookingReference: 'REF-SALDO-1',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        court: { id: 'court-1', priceDay: 60 },
        date: new Date('2026-09-20'),
        startTime: '19:00',
        duration: 2,
        user: { id: 'user-1', email: 'cliente@test.com' },
        pricing: { totalPrice: 120 },
        payment: mockExistingPayment,
        proofOfPaymentUrl: 'https://s3.amazonaws.com/bucket/primer-comprobante.png',
      };

      mockBookingService.findOneComplete.mockResolvedValue(mockBooking);
      mockPaymentRepo.save.mockImplementation((p) => Promise.resolve(p));

      const dto = {
        bookingId: 'booking-1',
        method: PaymentMethod.YAPE,
        type: PaymentType.SALDO,
        amount: 60,
        comprobanteUrl: 'https://s3.amazonaws.com/bucket/segundo-comprobante-saldo.png',
      };

      const result = await service.createBookingManualPayment(dto as any, mockBooking.user as any);

      expect(result.message).toContain('saldo restante enviado exitosamente');
      expect(mockExistingPayment.saldoAmount).toBe(60);
      expect(mockExistingPayment.saldoComprobanteUrl).toBe('https://s3.amazonaws.com/bucket/segundo-comprobante-saldo.png');
      expect(mockExistingPayment.saldoStatus).toBe('PENDIENTE');
      expect(mockPaymentRepo.save).toHaveBeenCalledWith(mockExistingPayment);
      // El comprobante inicial no debe ser sobreescrito en la reserva
      expect(mockBooking.proofOfPaymentUrl).toBe('https://s3.amazonaws.com/bucket/primer-comprobante.png');
    });

    it('debe rechazar registrar saldo si el saldo ya figura como PAGADO', async () => {
      const mockExistingPayment: any = {
        id: 'payment-1',
        status: PaymentStatus.PAID,
        type: PaymentType.ADELANTO,
        saldoStatus: 'PAGADO',
      };

      const mockBooking = {
        id: 'booking-1',
        payment: mockExistingPayment,
        pricing: { totalPrice: 120 },
      };

      mockBookingService.findOneComplete.mockResolvedValue(mockBooking);

      const dto = {
        bookingId: 'booking-1',
        type: PaymentType.SALDO,
        amount: 60,
        comprobanteUrl: 'https://s3.amazonaws.com/bucket/otro-comprobante.png',
      };

      await expect(service.createBookingManualPayment(dto as any, {} as any)).rejects.toThrow(
        'El saldo de esta reserva ya ha sido cancelado y aprobado por el club.',
      );
    });

    it('debe seguir bloqueando pagos iniciales (no saldo) si la reserva ya tiene pago PAID', async () => {
      const mockExistingPayment: any = {
        id: 'payment-1',
        status: PaymentStatus.PAID,
        type: PaymentType.ADELANTO,
      };

      const mockBooking = {
        id: 'booking-1',
        payment: mockExistingPayment,
        pricing: { totalPrice: 120 },
      };

      mockBookingService.findOneComplete.mockResolvedValue(mockBooking);

      const dto = {
        bookingId: 'booking-1',
        type: PaymentType.ADELANTO,
        amount: 60,
        comprobanteUrl: 'https://s3.amazonaws.com/bucket/comprobante-inicial-repetido.png',
      };

      await expect(service.createBookingManualPayment(dto as any, {} as any)).rejects.toThrow(
        'Esta reserva ya tiene un pago aprobado.',
      );
    });

    it('debe permitir re-enviar comprobante de saldo si el saldo previo estaba en RECHAZADO', async () => {
      const mockExistingPayment: any = {
        id: 'payment-1',
        status: PaymentStatus.PAID,
        type: PaymentType.ADELANTO,
        saldoStatus: 'RECHAZADO',
        saldoComprobanteUrl: 'https://s3.amazonaws.com/bucket/comprobante-malo.png',
      };

      const mockBooking = {
        id: 'booking-1',
        payment: mockExistingPayment,
        pricing: { totalPrice: 100 },
      };

      mockBookingService.findOneComplete.mockResolvedValue(mockBooking);
      mockPaymentRepo.save.mockImplementation((p) => Promise.resolve(p));

      const dto = {
        bookingId: 'booking-1',
        type: PaymentType.SALDO,
        amount: 50,
        comprobanteUrl: 'https://s3.amazonaws.com/bucket/comprobante-corregido.png',
      };

      const res = await service.createBookingManualPayment(dto as any, {} as any);
      expect(res.payment.saldoStatus).toBe('PENDIENTE');
      expect(res.payment.saldoComprobanteUrl).toBe('https://s3.amazonaws.com/bucket/comprobante-corregido.png');
    });
  });

  describe('5) Auditoría de Saldo Restante por el Club (auditSaldoComprobante)', () => {
    it('debe CONFIRMAR el saldo restante y marcar la reserva con paymentStatus=PAID', async () => {
      const mockBookingItem: any = {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
      };
      const mockPayment: any = {
        id: 'pay-saldo-1',
        status: PaymentStatus.PAID, // adelanto ya aprobado
        type: PaymentType.ADELANTO,
        saldoStatus: 'PENDIENTE',
        saldoAmount: 50,
        bookings: [mockBookingItem],
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockImplementation((p) => Promise.resolve(p));

      const res = await service.auditSaldoComprobante('pay-saldo-1', 'CONFIRMAR', { name: 'Admin Club' } as any);

      expect(res.status).toBe('PAGADO');
      expect(mockPayment.saldoStatus).toBe('PAGADO');
      expect(mockBookingItem.paymentStatus).toBe(PaymentStatus.PAID);
      expect(mockBookingRepo.save).toHaveBeenCalledWith(mockBookingItem);
    });

    it('debe RECHAZAR el saldo restante con motivo para que el cliente re-envíe', async () => {
      const mockPayment: any = {
        id: 'pay-saldo-2',
        status: PaymentStatus.PAID,
        type: PaymentType.ADELANTO,
        saldoStatus: 'PENDIENTE',
        saldoAmount: 50,
        bookings: [],
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockImplementation((p) => Promise.resolve(p));

      const res = await service.auditSaldoComprobante(
        'pay-saldo-2',
        'RECHAZAR',
        { name: 'Admin Club' } as any,
        'Monto no coincide con los 50 restantes',
      );

      expect(res.status).toBe('RECHAZADO');
      expect(mockPayment.saldoStatus).toBe('RECHAZADO');
      expect(mockPayment.saldoNotas).toBe('Monto no coincide con los 50 restantes');
    });
  });

  describe('6) handleMercadoPagoWebhook Idempotency', () => {
    it('should ignore webhook if payment with same transactionId is already PAID', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'existing-payment-id',
        transactionId: '123456789',
        status: PaymentStatus.PAID,
      });

      await service.handleMercadoPagoWebhook({ type: 'payment', 'data.id': '123456789' });

      expect(mockPaymentRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockMailerService.sendBookingPaidNotifications).not.toHaveBeenCalled();
    });
  });
});
