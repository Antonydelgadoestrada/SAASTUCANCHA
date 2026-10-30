import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoyaltyService } from '../loyalty.service';
import { LoyaltyConfig } from '../entities/loyalty_config.entity';
import { LoyaltyReward } from '../entities/loyalty_reward.entity';
import { LoyaltyRedemption, LoyaltyRedemptionStatus } from '../entities/loyalty_redemption.entity';
import { LoyaltyTransaction, LoyaltyTransactionType } from '../entities/loyalty_transaction.entity';
import { LoyaltyBalance } from '../entities/loyalty_balance.entity';
import { Booking } from '../../booking/booking.entity';
import { Payment } from '../../payment/payment.entity';
import { Court } from '../../court/court.entity';
import { User } from '../../user/user.entity';
import { BookingService } from '../../booking/booking.service';
import { PaymentService } from '../../payment/payment.service';
import { ScheduleTemplateService } from '../../schedule/schedule-template.service';
import { CourtService } from '../../court/court.service';
import { UserService } from '../../user/user.service';
import { MailerService } from '../../mailer/mailer.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { MercadoPagoService } from '../../mecado-pago/mercado-pago.service';
import { S3Service } from '../../aws/s3.service';
import { ClubService } from '../../club/club.service';
import { LoyaltyRewardType } from '../enums/loyalty-reward-type.enum';
import { BookingStatus } from '../../booking/booking-status.enum';
import { PaymentStatus } from '../../payment/payment-status.enum';
import { UserRole } from '../../user/user-role.enum';
import { calculateCouponDiscount } from '../utils/discount-calculator';

describe('FASE 6: Verificación E2E de Cupones de Fidelidad y Hora Gratis', () => {
  let loyaltyService: LoyaltyService;
  let bookingService: BookingService;
  let paymentService: PaymentService;

  const originalLoyaltyEnv = process.env.LOYALTY_ENABLED;

  beforeAll(() => {
    process.env.LOYALTY_ENABLED = 'true';
  });

  afterAll(() => {
    if (originalLoyaltyEnv !== undefined) {
      process.env.LOYALTY_ENABLED = originalLoyaltyEnv;
    } else {
      delete process.env.LOYALTY_ENABLED;
    }
  });

  const mockClubId = 'club-uuid-alpha';
  const mockUserId = 'user-uuid-player';
  const mockCourtId = 'court-uuid-court1';

  const mockCourt: any = {
    id: mockCourtId,
    name: 'Cancha 1 (Cristal)',
    surface: 'Cristal',
    priceDay: 25, // 30 min = 25, 1h = 50
    priceNight: 35, // 30 min = 35, 1h = 70
    club: { id: mockClubId },
  };

  const mockClientUser: any = {
    id: mockUserId,
    email: 'jugador@tucancha.com',
    name: 'Jugador Frecuente',
    phone: '999888777',
    role: UserRole.USER,
  };

  const mockStaffUser: any = {
    id: 'staff-uuid-1',
    role: UserRole.CLUB,
    club: { id: mockClubId },
  };

  // Repositorios y Mocks
  let mockRedemptionRepo: any;
  let mockRewardRepo: any;
  let mockConfigRepo: any;
  let mockBalanceRepo: any;
  let mockTransactionRepo: any;
  let mockBookingRepo: any;
  let mockPaymentRepo: any;
  let mockCourtRepo: any;
  let mockUserRepo: any;
  let mockManager: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(async (entityClassOrEntity, entity) => {
        const item = entity || entityClassOrEntity;
        if (!item.id) item.id = 'generated-db-id';
        return item;
      }),
      create: jest.fn((entityClass, data) => ({ ...data, id: data.id || 'gen-id' })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      })),
    };

    mockRedemptionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'red-id' })),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockRewardRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'reward-id' })),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockConfigRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        clubId: mockClubId,
        isActive: true,
      }),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockBalanceRepo = {
      findOne: jest.fn(),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockTransactionRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockBookingRepo = {
      findOne: jest.fn(),
      save: jest.fn((b) => Promise.resolve({ id: 'booking-created-1', ...b })),
      manager: {
        transaction: jest.fn(async (cb) => await cb(mockManager)),
      },
    };

    mockPaymentRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((p) => Promise.resolve({ id: 'payment-created-1', ...p })),
      manager: {
        transaction: jest.fn(async (cb) => await cb(mockManager)),
      },
    };

    mockCourtRepo = {
      findOne: jest.fn().mockResolvedValue(mockCourt),
    };

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue(mockClientUser),
      findByEmail: jest.fn().mockResolvedValue(mockClientUser),
    };

    const mockDataSource = {
      transaction: jest.fn(async (cb) => {
        return await cb(mockManager);
      }),
      getRepository: jest.fn((entity) => {
        if (entity === User) return mockUserRepo;
        if (entity === Court) return mockCourtRepo;
        if (entity === LoyaltyRedemption) return mockRedemptionRepo;
        if (entity === LoyaltyBalance) return mockBalanceRepo;
        return { findOne: jest.fn(), save: jest.fn() };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        BookingService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(LoyaltyConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(LoyaltyReward), useValue: mockRewardRepo },
        { provide: getRepositoryToken(LoyaltyRedemption), useValue: mockRedemptionRepo },
        { provide: getRepositoryToken(LoyaltyTransaction), useValue: mockTransactionRepo },
        { provide: getRepositoryToken(LoyaltyBalance), useValue: mockBalanceRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Court), useValue: mockCourtRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: ScheduleTemplateService,
          useValue: {
            getAvailabilityByCourtAndDates: jest.fn().mockResolvedValue([
              { time: '10:00', status: 'available' },
              { time: '10:30', status: 'available' },
            ]),
          },
        },
        {
          provide: CourtService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockCourt),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn().mockResolvedValue(mockClientUser),
            update: jest.fn().mockResolvedValue(mockClientUser),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendBookingPaidNotifications: jest.fn().mockResolvedValue(undefined),
            sendBookingReservationNotifications: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            recordFromManualReservationPayment: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: MercadoPagoService, useValue: {} },
        { provide: S3Service, useValue: {} },
        { provide: ClubService, useValue: {} },
      ],
    }).compile();

    loyaltyService = module.get<LoyaltyService>(LoyaltyService);
    bookingService = module.get<BookingService>(BookingService);
    paymentService = new PaymentService(
      mockPaymentRepo,
      mockBookingRepo,
      {} as any,
      bookingService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loyaltyService,
    );
  });

  describe('1. Pure Calculator Validation', () => {
    it('calcula con precisión matemática descuentos fijos, porcentuales y hora gratis', () => {
      // Fijo
      const fixed = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValue: 20,
        courtPriceDay: 25,
        basePrice: 50,
      });
      expect(fixed.discountAmount).toBe(20);
      expect(fixed.netPrice).toBe(30);

      // Porcentual con tope
      const pct = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
        discountValue: 50,
        maxDiscountAmount: 30,
        courtPriceDay: 25,
        basePrice: 100,
      });
      expect(pct.discountAmount).toBe(30); // 50% de 100 es 50, pero tope es 30
      expect(pct.netPrice).toBe(70);

      // Hora Gratis diurna: 2 bloques de 25 = 50 soles
      const freeHour = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FREE_HOUR,
        courtPriceDay: 25,
        basePrice: 50,
      });
      expect(freeHour.discountAmount).toBe(50);
      expect(freeHour.netPrice).toBe(0);
    });
  });

  describe('2. Preview de Cupones (Multi-Tenant y Validaciones)', () => {
    it('debe rechazar vista previa si el cupón pertenece a otro club', async () => {
      // In loyaltyService.previewCoupon, findOne searches with { code, clubId }
      // If the code belongs to another club, findOne returns null for this club
      mockRedemptionRepo.findOne.mockResolvedValue(null);

      const res = await loyaltyService.previewCoupon(mockClubId, {
        code: 'TC-OTHER',
        courtId: mockCourtId,
        basePrice: 50,
        userEmail: 'jugador@tucancha.com',
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('no pertenece a este club');
    });

    it('debe rechazar vista previa si el cupón ya fue aplicado o entregado', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-used',
        clubId: mockClubId,
        userId: mockUserId,
        code: 'TC-USED',
        status: LoyaltyRedemptionStatus.APPLIED,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await loyaltyService.previewCoupon(mockClubId, {
        code: 'TC-USED',
        courtId: mockCourtId,
        basePrice: 50,
        userEmail: 'jugador@tucancha.com',
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('ya no está disponible');
    });

    it('debe rechazar vista previa si el cupón está vencido', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-exp',
        clubId: mockClubId,
        userId: mockUserId,
        code: 'TC-EXPIRED',
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() - 86400000), // Venció ayer
      });

      const res = await loyaltyService.previewCoupon(mockClubId, {
        code: 'TC-EXPIRED',
        courtId: mockCourtId,
        basePrice: 50,
        userEmail: 'jugador@tucancha.com',
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('ha expirado');
    });

    it('debe previsualizar con éxito un cupón de HORA GRATIS y retornar newTotalPrice: 0', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-free',
        clubId: mockClubId,
        code: 'TC-FREE1H',
        status: LoyaltyRedemptionStatus.PENDING,
        rewardNameSnapshot: '1 Hora Gratis Diurna',
        rewardTypeSnapshot: LoyaltyRewardType.FREE_HOUR,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockClientUser,
        userId: mockUserId,
      });

      const preview = await loyaltyService.previewCoupon(mockClubId, {
        code: 'tc-free1h', // minúsculas se normalizan
        courtId: mockCourtId,
        basePrice: 50,
        userEmail: 'jugador@tucancha.com',
      });

      expect(preview.valid).toBe(true);
      expect(preview.calculatedDiscount).toBe(50);
      expect(preview.newTotalPrice).toBe(0);
      expect(preview.rewardType).toBe(LoyaltyRewardType.FREE_HOUR);
    });
  });

  describe('3. Flujo Transaccional en Reserva Manual', () => {
    it('aplica cupón fijo, bloquea el canje con estado APPLIED y vincula bookingId', async () => {
      const mockRedemption = {
        id: 'red-fixed-1',
        clubId: mockClubId,
        userId: mockUserId,
        code: 'TC-DESC20',
        status: LoyaltyRedemptionStatus.PENDING,
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValueSnapshot: 20,
        expiresAt: new Date(Date.now() + 86400000),
      };

      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockRedemption),
      };
      mockManager.createQueryBuilder = jest.fn(() => qb);
      mockManager.findOne.mockResolvedValue(mockCourt);

      const dto = {
        courtId: mockCourtId,
        date: new Date('2026-11-20T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        duration: 1,
        price: '50',
        userEmail: 'jugador@tucancha.com',
        paymentMethod: 'efectivo',
        amountPaid: '30',
        couponCode: 'TC-DESC20',
      };

      const booking: any = await bookingService.createManualBooking(dto as any, mockStaffUser);

      expect(booking).toBeDefined();
      expect(mockRedemption.status).toBe(LoyaltyRedemptionStatus.APPLIED);
      expect((mockRedemption as any).appliedDiscountAmount).toBe(20);
      expect((mockRedemption as any).bookingId).toBe(booking.id);
      expect(booking.pricing.discounts).toBe(20);
      expect(booking.pricing.totalPrice).toBe(30);
      expect(booking.status).toBe(BookingStatus.CONFIRMED);
      expect(booking.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('aplica cupón de HORA GRATIS con precio 0: status CONFIRMED, paymentStatus PAID, paymentMethod coupon', async () => {
      const mockRedemption = {
        id: 'red-free-1',
        clubId: mockClubId,
        userId: mockUserId,
        code: 'TC-GRATIS',
        status: LoyaltyRedemptionStatus.PENDING,
        rewardTypeSnapshot: LoyaltyRewardType.FREE_HOUR,
        expiresAt: new Date(Date.now() + 86400000),
      };

      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockRedemption),
      };
      mockManager.createQueryBuilder = jest.fn(() => qb);
      mockManager.findOne.mockResolvedValue(mockCourt);

      const dto = {
        courtId: mockCourtId,
        date: new Date('2026-11-20T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        duration: 1,
        price: '50',
        userEmail: 'jugador@tucancha.com',
        amountPaid: '0',
        couponCode: 'TC-GRATIS',
      };

      const booking: any = await bookingService.createManualBooking(dto as any, mockStaffUser);

      expect(booking).toBeDefined();
      expect(booking.pricing.totalPrice).toBe(0);
      expect(booking.status).toBe(BookingStatus.CONFIRMED);
      expect(booking.paymentStatus).toBe(PaymentStatus.PAID);
      expect(booking.paymentMethod).toBe('coupon');
      expect(booking.payment.amount).toBe(0);
    });
  });

  describe('4. Cancelación y Rollback de Cupones', () => {
    it('restaura el cupón a PENDING y desvincula bookingId si el cupón NO ha expirado', async () => {
      const mockRedemption = {
        id: 'red-applied-active',
        code: 'TC-ACTIVO',
        status: LoyaltyRedemptionStatus.APPLIED,
        bookingId: 'booking-cancellable',
        expiresAt: new Date(Date.now() + 86400000), // Aún vigente
      };

      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockRedemption),
      };
      mockManager.createQueryBuilder = jest.fn(() => qb);

      const res = await loyaltyService.rollbackAppliedCoupon('booking-cancellable', mockManager);

      expect(res.rolledBack).toBe(true);
      expect(res.status).toBe(LoyaltyRedemptionStatus.PENDING);
      expect(mockRedemption.status).toBe(LoyaltyRedemptionStatus.PENDING);
      expect(mockRedemption.bookingId).toBeNull();
      expect((mockRedemption as any).appliedDiscountAmount).toBeNull();
    });

    it('reembolsa puntos y marca EXPIRED si el cupón expiró mientras la reserva estaba activa', async () => {
      const mockRedemption = {
        id: 'red-applied-expired',
        code: 'TC-VENCIO',
        clubId: mockClubId,
        userId: mockUserId,
        rewardCostSnapshot: 150,
        status: LoyaltyRedemptionStatus.APPLIED,
        bookingId: 'booking-expired-during-play',
        expiresAt: new Date(Date.now() - 3600000), // Expiró hace 1 hora
      };

      const mockBalance = {
        clubId: mockClubId,
        userId: mockUserId,
        balance: 50,
      };

      const redemptionQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockRedemption),
      };

      const balanceQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBalance),
      };

      mockManager.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(redemptionQb)
        .mockReturnValueOnce(balanceQb);

      const res = await loyaltyService.rollbackAppliedCoupon('booking-expired-during-play', mockManager);

      expect(res.rolledBack).toBe(true);
      expect(res.status).toBe(LoyaltyRedemptionStatus.EXPIRED);
      expect(mockRedemption.status).toBe(LoyaltyRedemptionStatus.EXPIRED);
      expect(mockBalance.balance).toBe(200); // 50 + 150
      expect(mockManager.save).toHaveBeenCalledWith(
        LoyaltyTransaction,
        expect.objectContaining({
          points: 150,
          type: 'REFUND',
        }),
      );
    });
  });

  describe('5. Protección contra Entrega Manual de Cupones en Recepción', () => {
    it('deliverReward RECHAZA con BadRequestException si se intenta entregar manualmente un cupón de descuento', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-coupon',
        clubId: mockClubId,
        code: 'TC-NODELIVER',
        status: LoyaltyRedemptionStatus.PENDING,
        rewardTypeSnapshot: LoyaltyRewardType.PERCENT_DISCOUNT, // Es cupón, no físico
      });

      await expect(
        loyaltyService.deliverReward({
          clubId: mockClubId,
          code: 'TC-NODELIVER',
          staffUserId: 'staff-uuid-1',
        }),
      ).rejects.toThrow('Los cupones de descuento se aplican al reservar una cancha');
    });
  });

  describe('6. Métricas del Club (Saldo Pendiente con Reservas Bonificadas)', () => {
    it('una reserva con precio 0 bonificada no genera saldo pendiente fantasma', async () => {
      const rawPayments = [
        {
          paymentId: 'pay-free-1',
          paymentStatus: PaymentStatus.PAID,
          amount: 0,
          saldoStatus: 'NO_APLICA',
          saldoAmount: 0,
          method: 'coupon',
          saldoMethod: null,
          paymentType: 'PAGO_COMPLETO',
          bookingId: 'booking-free-1',
          pricing: JSON.stringify({
            basePrice: 50,
            discounts: 50,
            totalPrice: 0,
          }),
          duration: 1,
          bookingStatus: BookingStatus.CONFIRMED,
          priceDay: 25,
          priceNight: 35,
        },
      ];

      mockPaymentRepo.query = jest.fn().mockResolvedValue(rawPayments);
      mockBookingRepo.query = jest.fn().mockResolvedValue([]);

      const summary = await paymentService.getClubPaymentMetrics(
        mockStaffUser,
        mockClubId,
      );

      expect(summary.totalRecaudado).toBe(0);
      expect(summary.saldoPendienteTotal).toBe(0);
      expect(summary.totalConfirmadosCount).toBe(1);
    });
  });
});
