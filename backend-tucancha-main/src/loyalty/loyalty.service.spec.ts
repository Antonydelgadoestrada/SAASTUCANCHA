import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyConfig } from './entities/loyalty_config.entity';
import { LoyaltyReward } from './entities/loyalty_reward.entity';
import { LoyaltyBalance } from './entities/loyalty_balance.entity';
import {
  LoyaltyRedemption,
  LoyaltyRedemptionStatus,
} from './entities/loyalty_redemption.entity';
import {
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from './entities/loyalty_transaction.entity';
import { LoyaltyRewardType } from './enums/loyalty-reward-type.enum';
import { User } from '../user/user.entity';
import { Court } from '../court/court.entity';

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  const mockClubId = 'club-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockStaffId = 'staff-uuid-1';
  const mockBookingId = 'booking-uuid-1';
  const mockRewardId = 'reward-uuid-1';

  // Repositories Mocks
  const mockConfigRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'config-1', ...entity })),
  };

  const mockRewardRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: mockRewardId, ...entity })),
  };

  const mockBalanceRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'balance-1', ...entity })),
  };

  const mockRedemptionRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'redemption-1', ...entity })),
  };

  const mockTxRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'tx-1', ...entity })),
  };

  // EntityManager / Transaction mock
  let mockManager: any;
  let mockQueryBuilder: any;

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockCourtRepo = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(async (cb) => {
      return await cb(mockManager);
    }),
    getRepository: jest.fn((entity) => {
      if (entity === User) return mockUserRepo;
      if (entity === Court) return mockCourtRepo;
      return { findOne: jest.fn() };
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env.LOYALTY_ENABLED = 'true';
    delete process.env.LOYALTY_ALLOWED_CLUB_IDS;

    mockUserRepo.findOne.mockResolvedValue({
      id: mockUserId,
      email: 'user@example.com',
    });
    mockCourtRepo.findOne.mockResolvedValue({
      id: 'court-uuid-1',
      priceDay: 25,
      priceNight: 35,
    });

    mockQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entityClass, dto) => ({ ...dto })),
      save: jest.fn(async (entityClassOrEntity, entity) => {
        return entity || entityClassOrEntity;
      }),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        {
          provide: getRepositoryToken(LoyaltyConfig),
          useValue: mockConfigRepo,
        },
        {
          provide: getRepositoryToken(LoyaltyReward),
          useValue: mockRewardRepo,
        },
        {
          provide: getRepositoryToken(LoyaltyBalance),
          useValue: mockBalanceRepo,
        },
        {
          provide: getRepositoryToken(LoyaltyRedemption),
          useValue: mockRedemptionRepo,
        },
        {
          provide: getRepositoryToken(LoyaltyTransaction),
          useValue: mockTxRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // 1. Feature Flag y Tenant Whitelist
  // =========================================================================
  describe('Feature Flag & Tenant Whitelist', () => {
    it('1. Debe retornar null si LOYALTY_ENABLED no es "true"', async () => {
      process.env.LOYALTY_ENABLED = 'false';

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '10:00',
      });

      expect(result).toBeNull();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('2. Debe retornar null si el club no está en LOYALTY_ALLOWED_CLUB_IDS', async () => {
      process.env.LOYALTY_ALLOWED_CLUB_IDS = 'other-club-1,other-club-2';

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '10:00',
      });

      expect(result).toBeNull();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('3. Debe retornar null si loyalty_config tiene isActive = false', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        clubId: mockClubId,
        isActive: false,
      });

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '10:00',
      });

      expect(result).toBeNull();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Otorgar Puntos por Reserva Pagada (handleBookingPaid)
  // =========================================================================
  describe('handleBookingPaid', () => {
    const activeConfigModeA = {
      clubId: mockClubId,
      isActive: true,
      mode: 'A',
      dayPoints: 10,
      nightPoints: 20,
      nightStartsAt: '18:00',
    };

    it('4. Modo A Día: debe otorgar dayPoints cuando horario < nightStartsAt', async () => {
      mockConfigRepo.findOne.mockResolvedValue(activeConfigModeA);
      mockTxRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue(null);

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 50,
        paidReservationsCount: 2,
      });

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '15:30',
      });

      expect(result).toEqual({
        pointsAwarded: 10,
        newBalance: 60,
      });
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('5. Modo A Noche: debe otorgar nightPoints cuando horario >= nightStartsAt', async () => {
      mockConfigRepo.findOne.mockResolvedValue(activeConfigModeA);
      mockTxRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue(null);

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 100,
        paidReservationsCount: 5,
      });

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '19:00',
      });

      expect(result).toEqual({
        pointsAwarded: 20,
        newBalance: 120,
      });
    });

    it('6. Idempotencia: segunda llamada con mismo bookingId no debe duplicar puntos', async () => {
      mockConfigRepo.findOne.mockResolvedValue(activeConfigModeA);
      mockTxRepo.findOne.mockResolvedValue({
        id: 'existing-tx-1',
        bookingId: mockBookingId,
        type: LoyaltyTransactionType.EARN_DAY,
      });

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '10:00',
      });

      expect(result).toBeNull();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('7a. Modo B: reserva normal (no múltiplo) da 0 puntos pero incrementa conteo', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        clubId: mockClubId,
        isActive: true,
        mode: 'B',
        bonusEveryX: 5,
        bonusPoints: 50,
      });
      mockTxRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue(null);

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 0,
        paidReservationsCount: 1, // Pasará a 2 (no múltiplo de 5)
      });

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '10:00',
      });

      expect(result).toEqual({
        pointsAwarded: 0,
        newBalance: 0,
      });
    });

    it('7b. Modo B: reserva que alcanza el múltiplo (bonusEveryX) otorga bonusPoints', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        clubId: mockClubId,
        isActive: true,
        mode: 'B',
        bonusEveryX: 5,
        bonusPoints: 50,
      });
      mockTxRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue(null);

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 10,
        paidReservationsCount: 4, // Pasará a 5 (múltiplo de 5)
      });

      const result = await service.handleBookingPaid({
        clubId: mockClubId,
        userId: mockUserId,
        bookingId: mockBookingId,
        bookingStartTime: '10:00',
      });

      expect(result).toEqual({
        pointsAwarded: 50,
        newBalance: 60,
      });
    });
  });

  // =========================================================================
  // 3. Canje de Premios (redeemReward)
  // =========================================================================
  describe('redeemReward', () => {
    it('8. Canje exitoso: saldo suficiente descuenta puntos, genera código y crea redención PENDING', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });

      mockManager.findOne.mockResolvedValueOnce({
        id: mockRewardId,
        clubId: mockClubId,
        name: 'Bebida Gatorade',
        pointsCost: 30,
        isActive: true,
      });

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 50,
      });

      const result = await service.redeemReward({
        clubId: mockClubId,
        userId: mockUserId,
        rewardId: mockRewardId,
      });

      expect(result.newBalance).toBe(20);
      expect(result.redemption.rewardNameSnapshot).toBe('Bebida Gatorade');
      expect(result.redemption.code).toMatch(/^TC-/);
      expect(result.redemption.status).toBe(LoyaltyRedemptionStatus.PENDING);
    });

    it('9. Canje rechazado: saldo insuficiente lanza BadRequestException', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });

      mockManager.findOne.mockResolvedValueOnce({
        id: mockRewardId,
        clubId: mockClubId,
        pointsCost: 100,
        isActive: true,
      });

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 20, // 20 < 100
      });

      await expect(
        service.redeemReward({
          clubId: mockClubId,
          userId: mockUserId,
          rewardId: mockRewardId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('10. Canje pesimista: valida el uso de setLock("pessimistic_write")', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });

      mockManager.findOne.mockResolvedValueOnce({
        id: mockRewardId,
        clubId: mockClubId,
        pointsCost: 10,
        isActive: true,
      });

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 50,
      });

      await service.redeemReward({
        clubId: mockClubId,
        userId: mockUserId,
        rewardId: mockRewardId,
      });

      expect(mockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  // =========================================================================
  // 4. Entrega de Premios (deliverReward)
  // =========================================================================
  describe('deliverReward', () => {
    it('11. Entrega exitosa: código válido en estado PENDING pasa a DELIVERED', async () => {
      const validPendingRedemption = {
        id: 'red-1',
        code: 'TC-ABC123',
        clubId: mockClubId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000), // Futuro
      };
      mockRedemptionRepo.findOne.mockResolvedValue(validPendingRedemption);
      mockRedemptionRepo.save.mockImplementation((ent) => Promise.resolve(ent));

      const result = await service.deliverReward({
        clubId: mockClubId,
        code: 'TC-ABC123',
        staffUserId: mockStaffId,
      });

      expect(result.status).toBe(LoyaltyRedemptionStatus.DELIVERED);
      expect(result.resolvedByUserId).toBe(mockStaffId);
      expect(result.resolvedAt).toBeDefined();
    });

    it('12a. Entrega fallida: canje ya entregado previamente lanza BadRequestException', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-2',
        code: 'TC-YAENTREGADO',
        clubId: mockClubId,
        status: LoyaltyRedemptionStatus.DELIVERED,
        expiresAt: new Date(Date.now() + 1000000),
      });

      await expect(
        service.deliverReward({
          clubId: mockClubId,
          code: 'TC-YAENTREGADO',
          staffUserId: mockStaffId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('12b. Entrega fallida: canje expirado lanza BadRequestException', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-3',
        code: 'TC-EXPIRADO',
        clubId: mockClubId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000000), // Pasado
        rewardCostSnapshot: 30,
        userId: mockUserId,
      });

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 10,
      });

      await expect(
        service.deliverReward({
          clubId: mockClubId,
          code: 'TC-EXPIRADO',
          staffUserId: mockStaffId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('12c. Entrega rechazada: los premios tipo cupón no se pueden entregar manualmente en mostrador (RN2)', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-coupon',
        code: 'TC-COUPON',
        clubId: mockClubId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardCostSnapshot: 50,
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
        userId: mockUserId,
      });

      await expect(
        service.deliverReward({
          clubId: mockClubId,
          code: 'TC-COUPON',
          staffUserId: mockStaffId,
        }),
      ).rejects.toThrow(
        'Los cupones de descuento se aplican al reservar una cancha, no se entregan manualmente',
      );
    });
  });

  // =========================================================================
  // 5. Rechazo de Canje con Reembolso (rejectRedemption)
  // =========================================================================
  describe('rejectRedemption', () => {
    it('13. Rechazo de canje: marca REJECTED, reembolsa puntos y crea tx REFUND', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        id: 'red-4',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        rewardCostSnapshot: 40,
      });

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 10,
      });

      const result = await service.rejectRedemption({
        clubId: mockClubId,
        redemptionId: 'red-4',
        reason: 'Sin stock del producto en almacén',
        staffUserId: mockStaffId,
      });

      expect(result.status).toBe(LoyaltyRedemptionStatus.REJECTED);
      expect(result.rejectReason).toBe('Sin stock del producto en almacén');
      expect(result.resolvedByUserId).toBe(mockStaffId);
      expect(mockManager.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Reversión por Cancelación de Reserva (handleBookingCancelled)
  // =========================================================================
  describe('handleBookingCancelled', () => {
    it('14. Cancelación de reserva: revierte puntos ganados y crea tx REVERSAL sin saldo negativo', async () => {
      mockTxRepo.find.mockResolvedValue([
        {
          id: 'tx-earn-1',
          clubId: mockClubId,
          userId: mockUserId,
          bookingId: mockBookingId,
          type: LoyaltyTransactionType.EARN_DAY,
          points: 25,
        },
      ]);
      mockTxRepo.findOne.mockResolvedValue(null); // No hay reversión previa

      mockQueryBuilder.getOne.mockResolvedValue({
        clubId: mockClubId,
        userId: mockUserId,
        balance: 30,
        paidReservationsCount: 3,
      });

      await service.handleBookingCancelled({
        bookingId: mockBookingId,
      });

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. Previsualización de Cupón (previewCoupon)
  // =========================================================================
  describe('previewCoupon', () => {
    it('15a. Preview exitoso con cupón FIXED_DISCOUNT', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-fixed',
        code: 'TC-DESC15',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValueSnapshot: 15,
        maxDiscountSnapshot: null,
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-DESC15',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(true);
      expect(res.calculatedDiscount).toBe(15);
      expect(res.newTotalPrice).toBe(35);
      expect(res.redemptionId).toBe('red-fixed');
    });

    it('15b. Preview exitoso con cupón PERCENT_DISCOUNT con tope maxDiscount', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-pct',
        code: 'TC-PCT50',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.PERCENT_DISCOUNT,
        discountValueSnapshot: 50,
        maxDiscountSnapshot: 20, // 50% de 60 = 30, pero tope es 20
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-PCT50',
        userEmail: 'user@example.com',
        courtId: 'court-uuid-1',
        basePrice: 60,
      });

      expect(res.valid).toBe(true);
      expect(res.calculatedDiscount).toBe(20);
      expect(res.newTotalPrice).toBe(40);
    });

    it('15c. Preview exitoso con cupón FREE_HOUR (2 * priceDay)', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-free',
        code: 'TC-GRATIS1',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.FREE_HOUR,
        discountValueSnapshot: null,
        maxDiscountSnapshot: null,
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-GRATIS1',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 60,
      });

      expect(res.valid).toBe(true);
      expect(res.calculatedDiscount).toBe(50);
      expect(res.newTotalPrice).toBe(10);
    });

    it('15d. Preview fallido si fidelidad está desactivada para el club', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: false });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-DESC15',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toBe('El programa de fidelidad no está activo para este club');
    });

    it('15e. Preview fallido si el cupón está expirado', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-exp',
        code: 'TC-EXP',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() - 50000), // Pasado
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValueSnapshot: 10,
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-EXP',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('ha expirado');
    });

    it('15f. Preview fallido si el cupón no pertenece al club', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue(null);

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-OTROCLUB',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('no encontrado o no pertenece');
    });

    it('15g. Preview fallido si el cupón pertenece a otro cliente', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-user2',
        code: 'TC-USER2',
        clubId: mockClubId,
        userId: 'different-user-uuid',
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-USER2',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toBe('El cupón no pertenece al cliente seleccionado');
    });

    it('15h. Preview fallido si el cupón ya no está PENDING (e.g. APPLIED)', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-applied',
        code: 'TC-APPLIED',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.APPLIED,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-APPLIED',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('ya no está disponible');
    });

    it('15i. Preview fallido si el premio es TEXT_ONLY', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockRedemptionRepo.findOne.mockResolvedValue({
        id: 'red-text',
        code: 'TC-TEXT',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.TEXT_ONLY,
      });

      const res = await service.previewCoupon(mockClubId, {
        code: 'TC-TEXT',
        userId: mockUserId,
        courtId: 'court-uuid-1',
        basePrice: 50,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('es informativo y no aplica descuento');
    });
  });

  // =========================================================================
  // 8. Aplicación de Cupón en Transacción (applyManualCouponInsideTransaction)
  // =========================================================================
  describe('applyManualCouponInsideTransaction', () => {
    it('16a. Aplica cupón exitosamente con lock pesimista y actualiza estado a APPLIED', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });

      const redemptionEntity: any = {
        id: 'red-10',
        code: 'TC-VALID',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
        rewardTypeSnapshot: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValueSnapshot: 20,
        maxDiscountSnapshot: null,
      };

      mockQueryBuilder.getOne.mockResolvedValue(redemptionEntity);
      mockManager.findOne.mockImplementation((entityClass: any) => {
        if (entityClass === Court) {
          return Promise.resolve({ id: 'court-1', priceDay: 25 });
        }
        return Promise.resolve(null);
      });

      const result = await service.applyManualCouponInsideTransaction(
        mockManager,
        {
          clubId: mockClubId,
          userId: mockUserId,
          couponCode: 'tc-valid',
          bookingId: mockBookingId,
          courtId: 'court-1',
          basePrice: 50,
        },
      );

      expect(mockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(redemptionEntity.status).toBe(LoyaltyRedemptionStatus.APPLIED);
      expect(redemptionEntity.bookingId).toBe(mockBookingId);
      expect(redemptionEntity.appliedDiscountAmount).toBe(20);
      expect(mockManager.save).toHaveBeenCalledWith(LoyaltyRedemption, redemptionEntity);
      expect(result.discountAmount).toBe(20);
      expect(result.redemptionId).toBe('red-10');
    });

    it('16b. Falla si el cupón no existe en el club', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.applyManualCouponInsideTransaction(mockManager, {
          clubId: mockClubId,
          userId: mockUserId,
          couponCode: 'TC-NOEXISTE',
          bookingId: mockBookingId,
          courtId: 'court-1',
          basePrice: 50,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('16c. Falla si el cupón pertenece a otro usuario', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockQueryBuilder.getOne.mockResolvedValue({
        id: 'red-other',
        code: 'TC-OTHER',
        clubId: mockClubId,
        userId: 'different-user',
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 1000000),
      });

      await expect(
        service.applyManualCouponInsideTransaction(mockManager, {
          clubId: mockClubId,
          userId: mockUserId,
          couponCode: 'TC-OTHER',
          bookingId: mockBookingId,
          courtId: 'court-1',
          basePrice: 50,
        }),
      ).rejects.toThrow('El cupón de fidelidad no pertenece al cliente de la reserva');
    });

    it('16d. Falla si el cupón ya no está en estado PENDING', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockQueryBuilder.getOne.mockResolvedValue({
        id: 'red-applied',
        code: 'TC-APPLIED',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.APPLIED,
        expiresAt: new Date(Date.now() + 1000000),
      });

      await expect(
        service.applyManualCouponInsideTransaction(mockManager, {
          clubId: mockClubId,
          userId: mockUserId,
          couponCode: 'TC-APPLIED',
          bookingId: mockBookingId,
          courtId: 'court-1',
          basePrice: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('16e. Falla si el cupón ha expirado', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockQueryBuilder.getOne.mockResolvedValue({
        id: 'red-exp',
        code: 'TC-EXP',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() - 100000),
      });

      await expect(
        service.applyManualCouponInsideTransaction(mockManager, {
          clubId: mockClubId,
          userId: mockUserId,
          couponCode: 'TC-EXP',
          bookingId: mockBookingId,
          courtId: 'court-1',
          basePrice: 50,
        }),
      ).rejects.toThrow('El cupón de fidelidad ha expirado');
    });

    it('16f. Falla si el premio es TEXT_ONLY', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ clubId: mockClubId, isActive: true });
      mockQueryBuilder.getOne.mockResolvedValue({
        id: 'red-text',
        code: 'TC-TEXT',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        rewardTypeSnapshot: LoyaltyRewardType.TEXT_ONLY,
      });

      await expect(
        service.applyManualCouponInsideTransaction(mockManager, {
          clubId: mockClubId,
          userId: mockUserId,
          couponCode: 'TC-TEXT',
          bookingId: mockBookingId,
          courtId: 'court-1',
          basePrice: 50,
        }),
      ).rejects.toThrow('Este premio no es un cupón de descuento aplicable a reservas');
    });
  });

  // =========================================================================
  // 9. Reversión de Cupón Aplicado (rollbackAppliedCoupon)
  // =========================================================================
  describe('rollbackAppliedCoupon', () => {
    it('17a. Cupón vigente: regresa a PENDING y desvincula la reserva', async () => {
      const redemptionEntity: any = {
        id: 'red-applied-1',
        code: 'TC-ROLLBACK1',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.APPLIED,
        bookingId: mockBookingId,
        appliedDiscountAmount: 25,
        appliedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000000), // Vigente
      };

      mockQueryBuilder.getOne.mockResolvedValue(redemptionEntity);

      const res = await service.rollbackAppliedCoupon(mockBookingId);

      expect(res.rolledBack).toBe(true);
      expect(res.status).toBe(LoyaltyRedemptionStatus.PENDING);
      expect(redemptionEntity.status).toBe(LoyaltyRedemptionStatus.PENDING);
      expect(redemptionEntity.bookingId).toBeNull();
      expect(redemptionEntity.appliedDiscountAmount).toBeNull();
      expect(mockManager.save).toHaveBeenCalledWith(LoyaltyRedemption, redemptionEntity);
    });

    it('17b. Cupón expirado durante la reserva: pasa a EXPIRED y reembolsa los puntos al usuario', async () => {
      const redemptionEntity: any = {
        id: 'red-applied-2',
        code: 'TC-ROLLBACK2',
        clubId: mockClubId,
        userId: mockUserId,
        status: LoyaltyRedemptionStatus.APPLIED,
        bookingId: mockBookingId,
        rewardCostSnapshot: 60,
        expiresAt: new Date(Date.now() - 50000), // Ya expiró
      };

      const balanceEntity = {
        clubId: mockClubId,
        userId: mockUserId,
        balance: 10,
        paidReservationsCount: 1,
      };

      mockQueryBuilder.getOne
        .mockResolvedValueOnce(redemptionEntity) // En query de redemption
        .mockResolvedValueOnce(balanceEntity); // En query de balance

      const res = await service.rollbackAppliedCoupon(mockBookingId);

      expect(res.rolledBack).toBe(true);
      expect(res.status).toBe(LoyaltyRedemptionStatus.EXPIRED);
      expect(redemptionEntity.status).toBe(LoyaltyRedemptionStatus.EXPIRED);
      expect(balanceEntity.balance).toBe(70); // 10 + 60
      expect(mockManager.save).toHaveBeenCalledWith(LoyaltyBalance, balanceEntity);
      expect(mockManager.save).toHaveBeenCalledWith(
        LoyaltyTransaction,
        expect.objectContaining({
          type: LoyaltyTransactionType.REFUND,
          points: 60,
        }),
      );
    });

    it('17c. Idempotencia: no hace nada si la redención no existe o no está en APPLIED', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const res = await service.rollbackAppliedCoupon('booking-inexistente');

      expect(res.rolledBack).toBe(false);
    });
  });

  // =========================================================================
  // 10. Validaciones en Catálogo de Premios (createReward / updateReward)
  // =========================================================================
  describe('createReward & updateReward validations', () => {
    it('18a. createReward falla si FIXED_DISCOUNT no especifica discountValue > 0', async () => {
      await expect(
        service.createReward(mockClubId, {
          name: 'Descuento Inválido',
          pointsCost: 50,
          rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
          discountValue: 0,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('18b. createReward falla si PERCENT_DISCOUNT tiene discountValue fuera de 1..100', async () => {
      await expect(
        service.createReward(mockClubId, {
          name: 'Descuento 150%',
          pointsCost: 50,
          rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
          discountValue: 150,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('18c. createReward falla si PERCENT_DISCOUNT especifica maxDiscountAmount <= 0', async () => {
      await expect(
        service.createReward(mockClubId, {
          name: 'Descuento 20% con tope 0',
          pointsCost: 50,
          rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
          discountValue: 20,
          maxDiscountAmount: 0,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('18d. createReward limpia discountValue y maxDiscountAmount para FREE_HOUR', async () => {
      const rewardCreated = await service.createReward(mockClubId, {
        name: 'Hora Gratis',
        pointsCost: 100,
        rewardType: LoyaltyRewardType.FREE_HOUR,
        discountValue: 999 as any,
        maxDiscountAmount: 999 as any,
      } as any);

      expect(rewardCreated.discountValue).toBeNull();
      expect(rewardCreated.maxDiscountAmount).toBeNull();
    });
  });
});
