import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { PromotionService } from '../../promotion/promotion.service';
import { UserRole } from '../../user/user-role.enum';
import { Promotion } from '../../promotion/promotion.entity';

describe('BookingService - Promotion Integration (Fase 5)', () => {
  let service: BookingService;

  const mockClubId = 'club-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockCourtId = 'court-uuid-1';

  const mockUser: any = {
    id: mockUserId,
    email: 'cliente@test.com',
    name: 'Cliente Prueba',
    phone: '987654321',
    role: UserRole.USER,
  };

  const mockCourt: any = {
    id: mockCourtId,
    name: 'Cancha 1',
    priceDay: 20,    // 20 por bloque -> 40 por hora día
    priceNight: 30,  // 30 por bloque -> 60 por hora noche
    promoDay: null,
    promoNight: null,
    club: { id: mockClubId },
  };

  const activePromo: Promotion = {
    id: 'promo-valle-1',
    name: 'Promo Hora Valle 25%',
    clubId: mockClubId,
    courtId: mockCourtId,
    applyToAllCourts: false,
    startTime: '10:00',
    endTime: '12:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    discountPercentage: 25,
    isActive: true,
  } as Promotion;

  let mockBookingRepo: any;
  let mockPaymentRepo: any;
  let mockScheduleTemplateService: any;
  let mockCourtService: any;
  let mockUserService: any;
  let mockMailerService: any;
  let mockTransactionsService: any;
  let mockPromotionService: any;

  beforeEach(async () => {
    mockBookingRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'booking-id-1', ...data })),
      findOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn(async (cb) => {
          const managerMock = {
            create: jest.fn((entity, data) => ({ ...data })),
            save: jest.fn((entity, data) => Promise.resolve({ id: 'saved-id', ...data })),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            findOne: jest.fn().mockResolvedValue(null),
          };
          return await cb(managerMock);
        }),
      },
    };

    mockPaymentRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'payment-id-1', ...data })),
    };

    mockScheduleTemplateService = {
      getAvailabilityByCourtAndDates: jest.fn().mockResolvedValue([
        { time: '10:00', status: 'available' },
        { time: '10:30', status: 'available' },
      ]),
    };

    mockCourtService = {
      findOne: jest.fn().mockResolvedValue(mockCourt),
    };

    mockUserService = {
      findByEmail: jest.fn().mockResolvedValue(mockUser),
    };

    mockMailerService = {
      sendBookingReservationNotifications: jest.fn().mockResolvedValue(true),
      sendBookingPaidNotifications: jest.fn().mockResolvedValue(true),
    };

    mockTransactionsService = {
      recordFromManualReservationPayment: jest.fn().mockResolvedValue(true),
    };

    mockPromotionService = {
      findActiveByCourt: jest.fn().mockImplementation((clubId, courtId) => {
        if (clubId === mockClubId && courtId === mockCourtId) {
          return Promise.resolve([activePromo]);
        }
        return Promise.resolve([]);
      }),
      calculatePrice: jest.fn().mockResolvedValue({
        regularTotalPrice: 40,
        finalTotalPrice: 30,
        totalDiscount: 10,
        hasPromotion: true,
      }),
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
        { provide: PromotionService, useValue: mockPromotionService },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  describe('createObjectBooking con Promociones Activas', () => {
    it('aplica automáticamente la promoción elegible al horario y fecha solicitados', async () => {
      // Reserva de 1 hora a las 10:00 (dentro de franja 10:00 a 12:00)
      // 1 hora = 2 bloques de 20 = 40 soles regular
      // Descuento 25% = 10 soles -> Precio final = 30 soles
      const booking = await service.createObjectBooking(
        {
          userEmail: mockUser.email,
          courtId: mockCourtId,
          date: '2026-11-02',
          startTime: '10:00',
          duration: 1,
        },
        mockUser,
      );

      expect(mockPromotionService.findActiveByCourt).toHaveBeenCalledWith(mockClubId, mockCourtId);
      expect(booking.pricing.basePrice).toBe(40);
      expect(booking.pricing.totalPrice).toBe(30);
      expect(booking.pricing.discounts).toBe(10);
      expect(booking.pricing.promoPrice).toBe(30);
    });

    it('no aplica descuento cuando el turno solicitado está fuera de la franja horaria de la promoción', async () => {
      // Turno a las 15:00 (fuera de la franja 10:00 a 12:00)
      const booking = await service.createObjectBooking(
        {
          userEmail: mockUser.email,
          courtId: mockCourtId,
          date: '2026-11-02',
          startTime: '15:00',
          duration: 1,
        },
        mockUser,
      );

      // Tarifa regular completa: 40 soles
      expect(booking.pricing.basePrice).toBe(40);
      expect(booking.pricing.totalPrice).toBe(40);
      expect(booking.pricing.discounts).toBe(0);
      expect(booking.pricing.promoPrice).toBeNull();
    });

    it('mantiene retrocompatibilidad con court.promoDay si no hay promoción por franja horaria activa', async () => {
      // Cancha con tarifa promo general en Court
      mockCourtService.findOne.mockResolvedValueOnce({
        ...mockCourt,
        promoDay: 15, // Tarifa promo general S/ 15 por bloque (S/ 30 hora)
      });
      // Sin promociones por franja
      mockPromotionService.findActiveByCourt.mockResolvedValueOnce([]);

      const booking = await service.createObjectBooking(
        {
          userEmail: mockUser.email,
          courtId: mockCourtId,
          date: '2026-11-02',
          startTime: '14:00',
          duration: 1,
        },
        mockUser,
      );

      // 2 bloques de 15 = 30 soles final, base = 40 soles, descuento = 10 soles
      expect(booking.pricing.basePrice).toBe(40);
      expect(booking.pricing.totalPrice).toBe(30);
      expect(booking.pricing.discounts).toBe(10);
      expect(booking.pricing.promoPrice).toBe(15);
    });

    it('resiliencia: si PromotionService falla, crea la reserva con tarifa regular sin abortar', async () => {
      mockPromotionService.findActiveByCourt.mockRejectedValueOnce(new Error('DB Timeout'));

      const booking = await service.createObjectBooking(
        {
          userEmail: mockUser.email,
          courtId: mockCourtId,
          date: '2026-11-02',
          startTime: '10:00',
          duration: 1,
        },
        mockUser,
      );

      // Conserva tarifa regular de 40 soles de forma segura
      expect(booking.pricing.basePrice).toBe(40);
      expect(booking.pricing.totalPrice).toBe(40);
      expect(booking.pricing.discounts).toBe(0);
    });
  });
});
