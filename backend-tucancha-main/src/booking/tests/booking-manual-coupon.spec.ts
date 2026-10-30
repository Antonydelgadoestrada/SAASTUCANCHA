import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingService } from '../booking.service';
import { Booking } from '../booking.entity';
import { Payment } from '../../payment/payment.entity';
import { ScheduleTemplateService } from '../../schedule/schedule-template.service';
import { CourtService } from '../../court/court.service';
import { MercadoPagoService } from '../../mecado-pago/mercado-pago.service';
import { UserService } from '../../user/user.service';
import { MailerService } from '../../mailer/mailer.service';
import { S3Service } from '../../aws/s3.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { LoyaltyService } from '../../loyalty/loyalty.service';
import { UserRole } from '../../user/user-role.enum';
import { BookingStatus } from '../booking-status.enum';
import { PaymentStatus } from '../../payment/payment-status.enum';
import { LoyaltyRewardType } from '../../loyalty/enums/loyalty-reward-type.enum';

describe('BookingService - Manual Booking with Loyalty Coupons (Fase 4)', () => {
  let service: BookingService;

  const mockClubId = 'club-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockCourtId = 'court-uuid-1';
  const mockStaffUser: any = {
    id: 'staff-uuid-1',
    role: UserRole.CLUB,
    club: { id: mockClubId },
  };

  const mockClientUser: any = {
    id: mockUserId,
    email: 'cliente@test.com',
    name: 'Cliente Prueba',
    phone: '987654321',
  };

  const mockCourt: any = {
    id: mockCourtId,
    name: 'Cancha Central',
    priceDay: 25,
    priceNight: 35,
    club: { id: mockClubId },
  };

  let mockManager: any;
  let mockBookingRepo: any;
  let mockPaymentRepo: any;
  let mockScheduleTemplateService: any;
  let mockCourtService: any;
  let mockUserService: any;
  let mockMailerService: any;
  let mockTransactionsService: any;
  let mockLoyaltyService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockManager = {
      create: jest.fn((entityClass, data) => ({ ...data, id: data.id || 'generated-id' })),
      save: jest.fn(async (entityClassOrEntity, entity) => {
        const item = entity || entityClassOrEntity;
        if (!item.id) item.id = 'saved-entity-id';
        return item;
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockBookingRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'booking-id-1', ...data })),
      findOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn(async (cb) => await cb(mockManager)),
      },
    };

    mockPaymentRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'payment-id-1', ...data })),
    };

    mockScheduleTemplateService = {
      getAvailabilityByCourtAndDates: jest.fn().mockResolvedValue([
        { time: '18:00', status: 'available' },
        { time: '18:30', status: 'available' },
      ]),
    };

    mockCourtService = {
      findOne: jest.fn().mockResolvedValue(mockCourt),
    };

    mockUserService = {
      findByEmail: jest.fn().mockResolvedValue(mockClientUser),
      update: jest.fn().mockResolvedValue(mockClientUser),
    };

    mockMailerService = {
      sendBookingPaidNotifications: jest.fn().mockResolvedValue(undefined),
      sendBookingReservationNotifications: jest.fn().mockResolvedValue(undefined),
    };

    mockTransactionsService = {
      recordFromManualReservationPayment: jest.fn().mockResolvedValue(undefined),
    };

    mockLoyaltyService = {
      applyManualCouponInsideTransaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: ScheduleTemplateService, useValue: mockScheduleTemplateService },
        { provide: CourtService, useValue: mockCourtService },
        { provide: MercadoPagoService, useValue: {} },
        { provide: UserService, useValue: mockUserService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: S3Service, useValue: {} },
        { provide: TransactionsService, useValue: mockTransactionsService },
        { provide: LoyaltyService, useValue: mockLoyaltyService },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  it('1. Reserva manual SIN cupón: se crea normalmente y cobra el monto base', async () => {
    const dto = {
      courtId: mockCourtId,
      date: new Date('2026-11-15T00:00:00.000Z'),
      startTime: '18:00',
      endTime: '19:00',
      duration: 1,
      price: '50',
      userEmail: 'cliente@test.com',
      paymentMethod: 'efectivo',
      amountPaid: '50',
    };

    const result: any = await service.createManualBooking(dto as any, mockStaffUser);

    expect(result).toBeDefined();
    expect(mockLoyaltyService.applyManualCouponInsideTransaction).not.toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('2. Reserva manual CON cupón fijo: descuenta monto exacto y aplica cupón dentro de la transacción', async () => {
    mockLoyaltyService.applyManualCouponInsideTransaction.mockResolvedValue({
      discountAmount: 20,
      redemptionId: 'redemption-uuid-1',
      rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
    });

    const dto = {
      courtId: mockCourtId,
      date: new Date('2026-11-15T00:00:00.000Z'),
      startTime: '18:00',
      endTime: '19:00',
      duration: 1,
      price: '50',
      userEmail: 'cliente@test.com',
      paymentMethod: 'efectivo',
      amountPaid: '30', // Saldo restante pagado en mostrador
      couponCode: 'TC-DESC20',
    };

    const result: any = await service.createManualBooking(dto as any, mockStaffUser);

    expect(result).toBeDefined();
    expect(mockLoyaltyService.applyManualCouponInsideTransaction).toHaveBeenCalledWith(
      mockManager,
      expect.objectContaining({
        clubId: mockClubId,
        userId: mockUserId,
        couponCode: 'TC-DESC20',
        basePrice: 50,
      }),
    );
    expect(result.pricing.discounts).toBe(20);
    expect(result.pricing.totalPrice).toBe(30);
    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('3. Reserva manual con HORA GRATIS (100% de descuento): total 0, CONFIRMED, paymentStatus PAID', async () => {
    mockLoyaltyService.applyManualCouponInsideTransaction.mockResolvedValue({
      discountAmount: 50, // Cubre el 100%
      redemptionId: 'redemption-uuid-free',
      rewardType: LoyaltyRewardType.FREE_HOUR,
    });

    const dto = {
      courtId: mockCourtId,
      date: new Date('2026-11-15T00:00:00.000Z'),
      startTime: '18:00',
      endTime: '19:00',
      duration: 1,
      price: '50',
      userEmail: 'cliente@test.com',
      paymentMethod: 'efectivo',
      amountPaid: '0',
      couponCode: 'TC-GRATIS1',
    };

    const result: any = await service.createManualBooking(dto as any, mockStaffUser);

    expect(result).toBeDefined();
    expect(result.pricing.discounts).toBe(50);
    expect(result.pricing.totalPrice).toBe(0);
    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    expect(result.paymentMethod).toBe('coupon');
    expect(result.payment.amount).toBe(0);
  });

  it('4. Intento de usar cupón en reserva recurrente (múltiples fechas): rechaza con BadRequestException', async () => {
    const dto = {
      courtId: mockCourtId,
      dates: [new Date('2026-11-15'), new Date('2026-11-22')],
      startTime: '18:00',
      endTime: '19:00',
      duration: 1,
      price: '100',
      userEmail: 'cliente@test.com',
      couponCode: 'TC-DESC20',
    };

    await expect(
      service.createManualBooking(dto as any, mockStaffUser),
    ).rejects.toThrow(
      'Los cupones de descuento solo pueden aplicarse a reservas individuales, no a reservas recurrentes',
    );
  });

  it('5. Si la aplicación del cupón falla dentro de la transacción, la transacción se aborta', async () => {
    mockLoyaltyService.applyManualCouponInsideTransaction.mockRejectedValue(
      new BadRequestException('El cupón ya fue utilizado o no está disponible'),
    );

    const dto = {
      courtId: mockCourtId,
      date: new Date('2026-11-15T00:00:00.000Z'),
      startTime: '18:00',
      endTime: '19:00',
      duration: 1,
      price: '50',
      userEmail: 'cliente@test.com',
      couponCode: 'TC-USADO',
    };

    await expect(
      service.createManualBooking(dto as any, mockStaffUser),
    ).rejects.toThrow('El cupón ya fue utilizado o no está disponible');
  });
});
