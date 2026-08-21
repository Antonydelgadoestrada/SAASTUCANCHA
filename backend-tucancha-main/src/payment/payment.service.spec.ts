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

describe('PaymentService - Booking Webhook & Idempotency', () => {
  let service: PaymentService;
  let paymentRepo: any;
  let bookingRepo: any;
  let bookingService: any;
  let mailerService: any;
  let scheduleTemplateService: any;

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
  };

  const mockMailerService = {
    sendBookingPaidNotifications: jest.fn().mockResolvedValue(true),
    sendBookingCancelledEmail: jest.fn().mockResolvedValue(true),
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
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    bookingRepo = module.get(getRepositoryToken(Booking));
    bookingService = module.get(BookingService);
    mailerService = module.get(MailerService);
    scheduleTemplateService = module.get(ScheduleTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMercadoPagoWebhook Idempotency', () => {
    it('should ignore webhook if payment with same transactionId is already PAID', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'existing-payment-id',
        transactionId: '123456789',
        status: PaymentStatus.PAID,
      });

      await service.handleMercadoPagoWebhook({ type: 'payment', 'data.id': '123456789' });

      // Transaction manager must not be called since it was already processed
      expect(mockPaymentRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockMailerService.sendBookingPaidNotifications).not.toHaveBeenCalled();
    });

    it('should process payment transactionally and occupy slots on approval', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null); // Not existing yet

      const mockBooking = {
        id: 'booking-uuid-1',
        paymentStatus: PaymentStatus.PENDING,
        status: BookingStatus.PENDING,
        court: { id: 'court-1' },
        date: new Date('2026-08-15'),
        startTime: '10:00',
        duration: 1,
        user: { email: 'test@example.com' },
        pricing: {},
      };

      mockPaymentRepo.manager.transaction.mockImplementation(async (trxCb) => {
        const mockTrxManager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn((_, dto) => ({ ...dto, id: 'new-payment-id' })),
          save: jest.fn((_, entity) => Promise.resolve(entity)),
        };
        mockBookingService.findOneComplete.mockResolvedValue(mockBooking);
        return trxCb(mockTrxManager);
      });

      await service.handleMercadoPagoWebhook({ type: 'payment', 'data.id': '123456789' });

      expect(mockPaymentRepo.manager.transaction).toHaveBeenCalled();
      expect(mockScheduleTemplateService.bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ courtId: 'court-1', status: 'occupied' }),
        ]),
      );
      expect(mockMailerService.sendBookingPaidNotifications).toHaveBeenCalled();
    });
  });
});
