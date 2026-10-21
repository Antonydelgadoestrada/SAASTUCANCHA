import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LoyaltyClubController } from './loyalty-club.controller';
import { LoyaltyUserController } from './loyalty-user.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyRedemptionStatus } from './entities/loyalty_redemption.entity';

describe('Loyalty Controllers', () => {
  let clubController: LoyaltyClubController;
  let userController: LoyaltyUserController;

  const mockClubId = 'club-uuid-123';
  const mockUserId = 'user-uuid-456';

  const mockUserWithClub: any = {
    id: mockUserId,
    email: 'clubowner@tucancha.pe',
    club: { id: mockClubId, name: 'Club Central' },
  };

  const mockUserWithoutClub: any = {
    id: mockUserId,
    email: 'player@tucancha.pe',
    club: null,
  };

  const mockLoyaltyService = {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    getRewards: jest.fn(),
    createReward: jest.fn(),
    updateReward: jest.fn(),
    deleteReward: jest.fn(),
    getClubRedemptions: jest.fn(),
    deliverReward: jest.fn(),
    rejectRedemption: jest.fn(),
    getUserBalance: jest.fn(),
    getUserRedemptions: jest.fn(),
    getUserTransactions: jest.fn(),
    redeemReward: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyClubController, LoyaltyUserController],
      providers: [
        {
          provide: LoyaltyService,
          useValue: mockLoyaltyService,
        },
      ],
    }).compile();

    clubController = module.get<LoyaltyClubController>(LoyaltyClubController);
    userController = module.get<LoyaltyUserController>(LoyaltyUserController);
  });

  it('should controllers be defined', () => {
    expect(clubController).toBeDefined();
    expect(userController).toBeDefined();
  });

  // =========================================================================
  // LoyaltyClubController
  // =========================================================================
  describe('LoyaltyClubController (Seguridad Multi-Tenant y Métodos)', () => {
    it('1. Debe lanzar ForbiddenException si el usuario no tiene club asociado', async () => {
      await expect(
        clubController.getConfig(mockUserWithoutClub),
      ).rejects.toThrow(ForbiddenException);
    });

    it('2. getConfig: debe invocar service.getConfig usando req.user.club.id', async () => {
      mockLoyaltyService.getConfig.mockResolvedValue({ clubId: mockClubId, isActive: true });

      const result = await clubController.getConfig(mockUserWithClub);

      expect(mockLoyaltyService.getConfig).toHaveBeenCalledWith(mockClubId);
      expect(result).toEqual({ clubId: mockClubId, isActive: true });
    });

    it('3. updateConfig: debe actualizar configuración con el clubId del JWT', async () => {
      const dto = { isActive: true, dayPoints: 15 };
      mockLoyaltyService.updateConfig.mockResolvedValue({ clubId: mockClubId, ...dto });

      const result = await clubController.updateConfig(mockUserWithClub, dto as any);

      expect(mockLoyaltyService.updateConfig).toHaveBeenCalledWith(mockClubId, dto);
      expect(result.dayPoints).toBe(15);
    });

    it('4. getRewards: debe obtener todos los premios del club (incluidos inactivos)', async () => {
      mockLoyaltyService.getRewards.mockResolvedValue([{ id: 'r1', name: 'Gatorade' }]);

      const result = await clubController.getRewards(mockUserWithClub);

      expect(mockLoyaltyService.getRewards).toHaveBeenCalledWith(mockClubId, false);
      expect(result).toHaveLength(1);
    });

    it('5. createReward: debe crear premio asignado al club autenticado', async () => {
      const dto = { name: 'Pelota de Pádel', pointsCost: 80 };
      mockLoyaltyService.createReward.mockResolvedValue({ id: 'r2', ...dto });

      const result = await clubController.createReward(mockUserWithClub, dto as any);

      expect(mockLoyaltyService.createReward).toHaveBeenCalledWith(mockClubId, dto);
      expect(result.id).toBe('r2');
    });

    it('6. updateReward: debe invocar updateReward con clubId, rewardId y dto', async () => {
      const dto = { pointsCost: 90 };
      mockLoyaltyService.updateReward.mockResolvedValue({ id: 'r2', pointsCost: 90 });

      const result = await clubController.updateReward(mockUserWithClub, 'r2', dto as any);

      expect(mockLoyaltyService.updateReward).toHaveBeenCalledWith(mockClubId, 'r2', dto);
      expect(result.pointsCost).toBe(90);
    });

    it('7. deleteReward: debe invocar deleteReward y retornar confirmación', async () => {
      mockLoyaltyService.deleteReward.mockResolvedValue(undefined);

      const result = await clubController.deleteReward(mockUserWithClub, 'r2');

      expect(mockLoyaltyService.deleteReward).toHaveBeenCalledWith(mockClubId, 'r2');
      expect(result.success).toBe(true);
    });

    it('8. getRedemptions: debe consultar canjes con status opcional', async () => {
      mockLoyaltyService.getClubRedemptions.mockResolvedValue([]);

      await clubController.getRedemptions(mockUserWithClub, LoyaltyRedemptionStatus.PENDING);

      expect(mockLoyaltyService.getClubRedemptions).toHaveBeenCalledWith(
        mockClubId,
        LoyaltyRedemptionStatus.PENDING,
      );
    });

    it('9. deliverReward: debe validar entrega con código y registrar el staffUserId', async () => {
      mockLoyaltyService.deliverReward.mockResolvedValue({
        code: 'TC-ABC123',
        status: LoyaltyRedemptionStatus.DELIVERED,
      });

      const result = await clubController.deliverReward(mockUserWithClub, { code: 'TC-ABC123' });

      expect(mockLoyaltyService.deliverReward).toHaveBeenCalledWith({
        clubId: mockClubId,
        code: 'TC-ABC123',
        staffUserId: mockUserId,
      });
      expect(result.status).toBe(LoyaltyRedemptionStatus.DELIVERED);
    });

    it('10. rejectRedemption: debe rechazar canje con motivo y staffUserId', async () => {
      mockLoyaltyService.rejectRedemption.mockResolvedValue({
        id: 'red-1',
        status: LoyaltyRedemptionStatus.REJECTED,
      });

      const result = await clubController.rejectRedemption(
        mockUserWithClub,
        'red-1',
        { reason: 'Sin stock' },
      );

      expect(mockLoyaltyService.rejectRedemption).toHaveBeenCalledWith({
        clubId: mockClubId,
        redemptionId: 'red-1',
        reason: 'Sin stock',
        staffUserId: mockUserId,
      });
      expect(result.status).toBe(LoyaltyRedemptionStatus.REJECTED);
    });
  });

  // =========================================================================
  // LoyaltyUserController
  // =========================================================================
  describe('LoyaltyUserController (Acciones del Jugador)', () => {
    it('11. getBalance: debe consultar saldo de puntos del usuario en el club especificado', async () => {
      mockLoyaltyService.getUserBalance.mockResolvedValue({ balance: 120, paidReservationsCount: 6 });

      const result = await userController.getBalance(mockUserWithClub, mockClubId);

      expect(mockLoyaltyService.getUserBalance).toHaveBeenCalledWith(mockClubId, mockUserId);
      expect(result.balance).toBe(120);
    });

    it('12. getRewards: debe consultar solo premios activos del club', async () => {
      mockLoyaltyService.getRewards.mockResolvedValue([{ id: 'r1', name: 'Gatorade', isActive: true }]);

      const result = await userController.getRewards(mockClubId);

      expect(mockLoyaltyService.getRewards).toHaveBeenCalledWith(mockClubId, true);
      expect(result).toHaveLength(1);
    });

    it('13. redeemReward: debe invocar redeemReward con el clubId, userId y rewardId', async () => {
      mockLoyaltyService.redeemReward.mockResolvedValue({
        redemption: { code: 'TC-XYZ987' },
        newBalance: 40,
      });

      const result = await userController.redeemReward(mockUserWithClub, {
        clubId: mockClubId,
        rewardId: 'r1',
      });

      expect(mockLoyaltyService.redeemReward).toHaveBeenCalledWith({
        clubId: mockClubId,
        userId: mockUserId,
        rewardId: 'r1',
      });
      expect(result.newBalance).toBe(40);
    });

    it('14. getRedemptions: debe consultar historial de canjes del usuario en el club', async () => {
      mockLoyaltyService.getUserRedemptions.mockResolvedValue([]);

      await userController.getRedemptions(mockUserWithClub, mockClubId);

      expect(mockLoyaltyService.getUserRedemptions).toHaveBeenCalledWith(mockClubId, mockUserId);
    });

    it('15. getTransactions: debe consultar historial de movimientos de puntos', async () => {
      mockLoyaltyService.getUserTransactions.mockResolvedValue([]);

      await userController.getTransactions(mockUserWithClub, mockClubId, 20);

      expect(mockLoyaltyService.getUserTransactions).toHaveBeenCalledWith(mockClubId, mockUserId, 20);
    });
  });
});
