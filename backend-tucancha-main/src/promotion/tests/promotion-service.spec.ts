import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PromotionService } from '../promotion.service';
import { Promotion } from '../promotion.entity';
import { Court } from '../../court/court.entity';

describe('PromotionService & Tenant Security (Fase 4)', () => {
  let service: PromotionService;

  const mockClubId = 'club-uuid-1';
  const otherClubId = 'club-uuid-2';
  const mockCourtId = 'court-uuid-1';

  const mockCourt: any = {
    id: mockCourtId,
    name: 'Cancha Central',
    priceDay: 20,
    priceNight: 30,
    club: { id: mockClubId },
  };

  const otherClubCourt: any = {
    id: 'court-other-club',
    name: 'Cancha Ajena',
    priceDay: 25,
    priceNight: 35,
    club: { id: otherClubId },
  };

  const mockPromotion: any = {
    id: 'promo-uuid-1',
    name: 'Promo 20%',
    clubId: mockClubId,
    courtId: mockCourtId,
    applyToAllCourts: false,
    startTime: '10:00',
    endTime: '12:00',
    daysOfWeek: [1, 2, 3],
    discountPercentage: 20,
    isActive: true,
  };

  let mockPromoRepo: any;
  let mockCourtRepo: any;

  beforeEach(async () => {
    mockPromoRepo = {
      find: jest.fn().mockResolvedValue([mockPromotion]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === mockPromotion.id) return Promise.resolve({ ...mockPromotion });
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => ({ id: 'new-promo-id', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 'saved-promo-id', ...entity })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockPromotion]),
      })),
    };

    mockCourtRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === mockCourtId) return Promise.resolve(mockCourt);
        if (where.id === otherClubCourt.id) return Promise.resolve(otherClubCourt);
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionService,
        { provide: getRepositoryToken(Promotion), useValue: mockPromoRepo },
        { provide: getRepositoryToken(Court), useValue: mockCourtRepo },
      ],
    }).compile();

    service = module.get<PromotionService>(PromotionService);
  });

  describe('createForClub (Seguridad y Validaciones)', () => {
    it('crea exitosamente una promoción asociada a una cancha propia', async () => {
      const res = await service.createForClub(
        {
          name: 'Promo Válida',
          courtId: mockCourtId,
          applyToAllCourts: false,
          startTime: '10:00',
          endTime: '12:00',
          daysOfWeek: [1, 2],
          discountPercentage: 20,
        },
        mockClubId,
      );

      expect(res.clubId).toBe(mockClubId);
      expect(res.courtId).toBe(mockCourtId);
      expect(res.applyToAllCourts).toBe(false);
      expect(mockPromoRepo.save).toHaveBeenCalled();
    });

    it('crea exitosamente una promoción global para todas las canchas (applyToAllCourts = true)', async () => {
      const res = await service.createForClub(
        {
          name: 'Promo Global',
          applyToAllCourts: true,
          startTime: '08:00',
          endTime: '12:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          discountPercentage: 15,
        },
        mockClubId,
      );

      expect(res.clubId).toBe(mockClubId);
      expect(res.courtId).toBeNull();
      expect(res.applyToAllCourts).toBe(true);
    });

    it('rechaza si startTime es mayor o igual a endTime', async () => {
      await expect(
        service.createForClub(
          {
            name: 'Horario Inválido',
            startTime: '14:00',
            endTime: '12:00', // Inválido: fin antes de inicio
            daysOfWeek: [1],
            discountPercentage: 20,
          },
          mockClubId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('IDOR: rechaza si se intenta asociar una cancha perteneciente a otro club', async () => {
      await expect(
        service.createForClub(
          {
            name: 'Ataque IDOR',
            courtId: otherClubCourt.id, // Pertenece a otherClubId
            applyToAllCourts: false,
            startTime: '10:00',
            endTime: '12:00',
            daysOfWeek: [1],
            discountPercentage: 20,
          },
          mockClubId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOneScoped & Aislamiento por Club', () => {
    it('obtiene la promoción si pertenece al club consultante', async () => {
      const res = await service.findOneScoped(mockPromotion.id, mockClubId);
      expect(res.id).toBe(mockPromotion.id);
    });

    it('rechaza con ForbiddenException si la promoción pertenece a otro club', async () => {
      await expect(service.findOneScoped(mockPromotion.id, otherClubId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si la promoción no existe', async () => {
      await expect(service.findOneScoped('no-existe', mockClubId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleActive & updateForClub', () => {
    it('toggleActive conmuta el estado de activo a inactivo', async () => {
      const res = await service.toggleActive(mockPromotion.id, mockClubId);
      expect(res.isActive).toBe(false);
      expect(mockPromoRepo.save).toHaveBeenCalled();
    });

    it('updateForClub actualiza porcentajes y franjas con verificación de pertenencia', async () => {
      const res = await service.updateForClub(
        mockPromotion.id,
        {
          discountPercentage: 35,
          startTime: '09:00',
        },
        mockClubId,
      );

      expect(res.discountPercentage).toBe(35);
      expect(res.startTime).toBe('09:00');
    });

    it('updateForClub rechaza franjas inconsistentes', async () => {
      await expect(
        service.updateForClub(
          mockPromotion.id,
          {
            startTime: '15:00',
            endTime: '11:00',
          },
          mockClubId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('calculatePrice', () => {
    it('cotiza el precio final usando la cancha y sus promociones activas', async () => {
      const res = await service.calculatePrice({
        courtId: mockCourtId,
        date: '2026-11-02', // Lunes
        startTime: '10:00',
        duration: 1, // 2 bloques (10:00, 10:30)
      });

      // Tarifa día = 20 por bloque -> 2 bloques = 40 soles
      // Promo 20% activa -> Descuento = 8 soles -> Final = 32 soles
      expect(res.regularTotalPrice).toBe(40);
      expect(res.totalDiscount).toBe(8);
      expect(res.finalTotalPrice).toBe(32);
      expect(res.hasPromotion).toBe(true);
    });
  });
});
