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

  const mockDataSource = {
    transaction: jest.fn(async (cb) => {
      return await cb(mockManager);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env.LOYALTY_ENABLED = 'true';
    delete process.env.LOYALTY_ALLOWED_CLUB_IDS;

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
});
