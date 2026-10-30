import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { Club } from '../club/club.entity';
import { DataSource } from 'typeorm';
import { ClubUserController } from './club-user.controller';
import * as bcrypt from 'bcrypt';

describe('Club Users Backend (Sprint FASE 2) - Staff Management & Isolation', () => {
  let service: UserService;
  let controller: ClubUserController;

  const mockClubId = 'club-uuid-1111';
  const mockOtherClubId = 'club-uuid-2222';

  const mockClubOwner: User = {
    id: 'owner-uuid-1',
    email: 'owner@clubtest.com',
    name: 'Propietario Club',
    password: 'hashed-password',
    role: UserRole.CLUB,
    isActive: true,
    isVerified: true,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    bookings: [],
    reviews: [],
    payments: [],
    club: { id: mockClubId, name: 'Club Test' } as Club,
  };

  const mockReceptionist: User = {
    id: 'staff-uuid-1',
    email: 'recepcion@clubtest.com',
    name: 'Recepcionista Juan',
    password: 'hashed-password',
    role: UserRole.RECEPCIONISTA,
    assignedClubId: mockClubId,
    isActive: true,
    isVerified: true,
    permissions: ['bookings', 'payments'],
    createdAt: new Date(),
    updatedAt: new Date(),
    bookings: [],
    reviews: [],
    payments: [],
  };

  let mockUserRepository: any;
  let mockClubRepository: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockUserRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'new-staff-uuid' })),
      save: jest.fn().mockImplementation((user) => Promise.resolve(user)),
      count: jest.fn().mockResolvedValue(10),
    };

    mockClubRepository = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === mockClubId) {
          return Promise.resolve({ id: mockClubId, name: 'Club Test' });
        }
        return Promise.resolve(null);
      }),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockClubRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClubUserController],
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    controller = module.get<ClubUserController>(ClubUserController);
  });

  describe('1. Creación de Recepcionista', () => {
    it('debe crear un recepcionista con rol RECEPCIONISTA, clubId asignado y contraseña hasheada', async () => {
      mockUserRepository.findOne.mockResolvedValue(null); // No existe previo

      const result = await service.createStaffUser(mockClubId, {
        name: 'Recepcionista Maria',
        email: 'maria@clubtest.com',
        password: 'Password123!',
        phone: '987654321',
        permissions: ['bookings', 'courts'],
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Recepcionista Maria',
          email: 'maria@clubtest.com',
          role: UserRole.RECEPCIONISTA,
          assignedClubId: mockClubId,
          permissions: ['bookings', 'courts'],
          isActive: true,
          isVerified: true,
        }),
      );
      // Validar que la contraseña guardada fue hasheada con bcrypt
      const savedPassword = mockUserRepository.create.mock.calls[0][0].password;
      expect(savedPassword).not.toBe('Password123!');
      expect(await bcrypt.compare('Password123!', savedPassword)).toBe(true);
    });

    it('debe rechazar la creación si el correo ya existe en la plataforma', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockReceptionist);

      await expect(
        service.createStaffUser(mockClubId, {
          name: 'Otro Nombre',
          email: 'recepcion@clubtest.com',
          password: 'Password123!',
          permissions: ['bookings'],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Aislamiento por Club (Multi-tenant & Anti-IDOR)', () => {
    it('el administrador de Club A no debe poder ver recepcionistas de Club B', async () => {
      mockUserRepository.find.mockResolvedValue([mockReceptionist]);

      await controller.getStaffUsers(mockClubOwner);

      expect(mockUserRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedClubId: mockClubId,
          }),
        }),
      );
    });

    it('un intento de modificar o eliminar un recepcionista de otro club debe lanzar NotFoundException', async () => {
      mockUserRepository.findOne.mockResolvedValue(null); // No encontrado bajo ese clubId

      await expect(
        service.updateStaffUser(mockOtherClubId, mockReceptionist.id, {
          name: 'Intento de Hack',
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.softDeleteStaffUser(mockOtherClubId, mockReceptionist.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('un usuario con rol RECEPCIONISTA no debe poder invocar endpoints del ClubUserController', async () => {
      await expect(
        controller.getStaffUsers(mockReceptionist),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.createStaffUser(mockReceptionist, {
          name: 'Nuevo',
          email: 'test@club.com',
          password: 'Password123',
          permissions: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Activación / Desactivación de Acceso', () => {
    it('debe desactivar el acceso del recepcionista cambiando isActive a false', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockReceptionist, isActive: true });

      const updated = await service.toggleStaffStatus(mockClubId, mockReceptionist.id, false);
      expect(updated.isActive).toBe(false);
    });

    it('debe reactivar el acceso del recepcionista cambiando isActive a true', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockReceptionist, isActive: false });

      const updated = await service.toggleStaffStatus(mockClubId, mockReceptionist.id, true);
      expect(updated.isActive).toBe(true);
    });
  });

  describe('4. Eliminación (Borrado Lógico / Soft Delete)', () => {
    it('debe realizar borrado lógico estableciendo deletedAt e isActive = false sin borrar el registro de BD', async () => {
      const staffTarget = { ...mockReceptionist };
      mockUserRepository.findOne.mockResolvedValue(staffTarget);

      const res = await service.softDeleteStaffUser(mockClubId, mockReceptionist.id);

      expect(res.success).toBe(true);
      expect(staffTarget.deletedAt).toBeInstanceOf(Date);
      expect(staffTarget.isActive).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalledWith(staffTarget);
    });
  });
});
