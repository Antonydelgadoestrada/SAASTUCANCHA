import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/user.service';
import { User } from '../../user/user.entity';
import { Club } from '../../club/club.entity';
import { UserRole } from '../../user/user-role.enum';
import { MailerService } from '../../mailer/mailer.service';
import { GoogleAuthService } from '../google-auth.service';
import { JwtStrategy } from '../jwt.strategy';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClubPermissionGuard } from '../../common/guards/club-permission.guard';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';

describe('FASE 4: Membresías y Bloqueo Heredado para Recepcionistas', () => {
  let authService: AuthService;
  let jwtStrategy: JwtStrategy;
  let permissionGuard: ClubPermissionGuard;
  let userService: Partial<UserService>;

  const mockClubActive: Club = {
    id: 'club-uuid-1',
    name: 'Club El Campeón',
    status: 'APPROVED',
  } as Club;

  const mockClubSuspended: Club = {
    id: 'club-uuid-1',
    name: 'Club El Campeón',
    status: 'SUSPENDED',
  } as Club;

  const rawPassword = 'Password123!';
  const hashedPassword = bcrypt.hashSync(rawPassword, 10);

  const mockActiveReceptionist: User = {
    id: 'staff-1',
    email: 'recepcion@elcampeon.com',
    name: 'Carlos Recepcionista',
    password: hashedPassword,
    role: UserRole.RECEPCIONISTA,
    isActive: true,
    isVerified: true,
    assignedClubId: mockClubActive.id,
    assignedClub: mockClubActive,
    club: mockClubActive,
    permissions: ['bookings', 'payments'],
  } as User;

  const mockDeactivatedReceptionist: User = {
    ...mockActiveReceptionist,
    id: 'staff-2',
    email: 'desactivado@elcampeon.com',
    isActive: false,
  } as User;

  const mockClubRepo = {
    save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    manager: {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
      }),
    },
  };

  const mockUserRepo = {
    save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      findOneById: jest.fn(),
      update: jest.fn().mockResolvedValue({} as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Club), useValue: mockClubRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailerService, useValue: { sendMail: jest.fn() } },
        { provide: GoogleAuthService, useValue: {} },
        {
          provide: JwtStrategy,
          useFactory: () => {
            return new JwtStrategy(
              userService as UserService,
              {
                getRepository: jest.fn().mockReturnValue({
                  findOne: jest.fn().mockResolvedValue(null),
                  save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
                }),
              } as unknown as DataSource,
              {
                get: jest.fn().mockReturnValue('JWT_SECRET_KEY'),
              } as unknown as ConfigService,
            );
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    permissionGuard = new ClubPermissionGuard(new Reflector());
  });

  describe('1. Inicio de Sesión (Login) y Bloqueo Heredado', () => {
    it('debe permitir login a recepcionista activo cuando el club está APPROVED', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockActiveReceptionist);

      const result = await authService.login({
        email: mockActiveReceptionist.email,
        password: rawPassword,
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('debe bloquear login si el club está SUSPENDED con el mensaje exacto para el recepcionista', async () => {
      const staffWithSuspendedClub: User = {
        ...mockActiveReceptionist,
        assignedClub: mockClubSuspended,
        club: mockClubSuspended,
      };
      (userService.findByEmail as jest.Mock).mockResolvedValue(staffWithSuspendedClub);

      await expect(
        authService.login({
          email: staffWithSuspendedClub.email,
          password: rawPassword,
        }),
      ).rejects.toThrow(
        new UnauthorizedException(
          `El acceso al club se encuentra temporalmente suspendido. Comunícate con el encargado de ${mockClubSuspended.name}.`,
        ),
      );
    });

    it('debe priorizar el bloqueo individual si el recepcionista tiene isActive = false', async () => {
      const staffDeactivatedWithSuspendedClub: User = {
        ...mockDeactivatedReceptionist,
        assignedClub: mockClubSuspended,
        club: mockClubSuspended,
      };
      (userService.findByEmail as jest.Mock).mockResolvedValue(staffDeactivatedWithSuspendedClub);

      await expect(
        authService.login({
          email: staffDeactivatedWithSuspendedClub.email,
          password: rawPassword,
        }),
      ).rejects.toThrow(
        new UnauthorizedException(
          `Tu acceso ha sido desactivado. Comunícate con el encargado de ${mockClubSuspended.name}.`,
        ),
      );
    });

    it('debe permitir el acceso automáticamente cuando el club pasa de SUSPENDED a APPROVED', async () => {
      // 1. Club suspendido -> rechaza
      const staffWithSuspendedClub: User = {
        ...mockActiveReceptionist,
        assignedClub: mockClubSuspended,
        club: mockClubSuspended,
      };
      (userService.findByEmail as jest.Mock).mockResolvedValue(staffWithSuspendedClub);

      await expect(
        authService.login({
          email: staffWithSuspendedClub.email,
          password: rawPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      // 2. Club reactivado (APPROVED) -> el recepcionista recupera el acceso sin alterar su cuenta
      const staffWithReactivatedClub: User = {
        ...mockActiveReceptionist,
        assignedClub: mockClubActive,
        club: mockClubActive,
      };
      (userService.findByEmail as jest.Mock).mockResolvedValue(staffWithReactivatedClub);

      const result = await authService.login({
        email: staffWithReactivatedClub.email,
        password: rawPassword,
      });

      expect(result).toHaveProperty('access_token');
    });
  });

  describe('2. Validación de Token en Sesión (JwtStrategy)', () => {
    it('debe rechazar token existente en JwtStrategy si el club se encuentra SUSPENDED', async () => {
      const staffWithSuspendedClub: User = {
        ...mockActiveReceptionist,
        assignedClub: mockClubSuspended,
        club: mockClubSuspended,
      };
      (userService.findOneById as jest.Mock).mockResolvedValue(staffWithSuspendedClub);

      await expect(
        jwtStrategy.validate({ sub: staffWithSuspendedClub.id, email: staffWithSuspendedClub.email }),
      ).rejects.toThrow(
        new UnauthorizedException(
          `El acceso al club se encuentra temporalmente suspendido. Comunícate con el encargado de ${mockClubSuspended.name}.`,
        ),
      );
    });

    it('debe validar token correctamente en JwtStrategy si el club está APPROVED', async () => {
      (userService.findOneById as jest.Mock).mockResolvedValue(mockActiveReceptionist);

      const validated = await jwtStrategy.validate({
        sub: mockActiveReceptionist.id,
        email: mockActiveReceptionist.email,
      });

      expect(validated.id).toBe(mockActiveReceptionist.id);
    });
  });

  describe('3. Defensa en Profundidad (ClubPermissionGuard)', () => {
    it('debe rechazar en guard si el club del recepcionista está SUSPENDED', () => {
      const staffWithSuspendedClub: User = {
        ...mockActiveReceptionist,
        assignedClub: mockClubSuspended,
        club: mockClubSuspended,
      };

      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: staffWithSuspendedClub }),
        }),
      } as any;

      jest.spyOn(permissionGuard['reflector'], 'getAllAndOverride').mockReturnValue('bookings');

      expect(() => permissionGuard.canActivate(mockContext)).toThrow(
        new ForbiddenException(
          `El acceso al club se encuentra temporalmente suspendido. Comunícate con el encargado de ${mockClubSuspended.name}.`,
        ),
      );
    });
  });
});
