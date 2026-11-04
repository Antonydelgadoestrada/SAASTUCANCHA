import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../user.service';
import { ClubUserController } from '../club-user.controller';
import { AuthService } from '../../auth/auth.service';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { ClubPermissionGuard } from '../../common/guards/club-permission.guard';
import { MailerService } from '../../mailer/mailer.service';
import { User } from '../user.entity';
import { Club } from '../../club/club.entity';
import { UserRole } from '../user-role.enum';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GoogleAuthService } from '../../auth/google-auth.service';
import * as bcrypt from 'bcrypt';

describe('FASE 7: Matriz Integral de Seguridad y Pruebas E2E (Casos 1 al 13)', () => {
  let userService: UserService;
  let clubUserController: ClubUserController;
  let authService: AuthService;
  let jwtStrategy: JwtStrategy;
  let permissionGuard: ClubPermissionGuard;

  const clubAId = 'club-uuid-A';
  const clubBId = 'club-uuid-B';

  const mockClubA: Club = {
    id: clubAId,
    name: 'Club A Deportivo',
    status: 'APPROVED',
  } as Club;

  const mockClubB: Club = {
    id: clubBId,
    name: 'Club B Rivales',
    status: 'APPROVED',
  } as Club;

  const rawPassword = 'Password123!';
  const hashedPassword = bcrypt.hashSync(rawPassword, 10);

  let inMemoryUsers: User[] = [];

  const mockUserRepository = {
    create: jest.fn().mockImplementation((dto) => ({
      id: `staff-uuid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...dto,
    })),
    save: jest.fn().mockImplementation((user) => {
      const idx = inMemoryUsers.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        inMemoryUsers[idx] = { ...inMemoryUsers[idx], ...user };
        return Promise.resolve(inMemoryUsers[idx]);
      }
      inMemoryUsers.push(user);
      return Promise.resolve(user);
    }),
    find: jest.fn().mockImplementation(({ where }) => {
      return Promise.resolve(
        inMemoryUsers.filter((u) => {
          if (where.assignedClubId && u.assignedClubId !== where.assignedClubId) return false;
          if (where.role && u.role !== where.role) return false;
          if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
          if (u.deletedAt !== null && u.deletedAt !== undefined) return false;
          return true;
        }),
      );
    }),
    findOne: jest.fn().mockImplementation(({ where }) => {
      const user = inMemoryUsers.find((u) => {
        if (where.id && u.id !== where.id) return false;
        if (where.email && u.email !== where.email) return false;
        if (where.assignedClubId && u.assignedClubId !== where.assignedClubId) return false;
        if (u.deletedAt !== null && u.deletedAt !== undefined) return false;
        return true;
      });
      if (!user) return Promise.resolve(null);
      const cloned = { ...user };
      if (cloned.assignedClubId === clubAId) {
        cloned.assignedClub = mockClubA;
        cloned.club = mockClubA;
      } else if (cloned.assignedClubId === clubBId) {
        cloned.assignedClub = mockClubB;
        cloned.club = mockClubB;
      }
      return Promise.resolve(cloned);
    }),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockImplementation((id, partial) => {
      const idx = inMemoryUsers.findIndex((u) => u.id === id);
      if (idx >= 0) {
        inMemoryUsers[idx] = { ...inMemoryUsers[idx], ...partial };
      }
      return Promise.resolve({ affected: 1 });
    }),
  };

  const mockClubRepository = {
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      if (id === clubAId) return Promise.resolve(mockClubA);
      if (id === clubBId) return Promise.resolve(mockClubB);
      return Promise.resolve(null);
    }),
    save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    manager: {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
      }),
    },
  };

  const mockDataSource = {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity === User || entity === 'User') return mockUserRepository;
      if (entity === Club || entity === 'Club') return mockClubRepository;
      return {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
        count: jest.fn().mockResolvedValue(0),
      };
    }),
  } as unknown as DataSource;

  const mockMailerService = {
    sendStaffWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
    getStaffBookingEmails: jest.fn(),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token-xyz'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    inMemoryUsers = [];
    jest.clearAllMocks();
    mockClubA.status = 'APPROVED';
    mockClubB.status = 'APPROVED';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        ClubUserController,
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Club), useValue: mockClubRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: MailerService, useValue: mockMailerService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: GoogleAuthService, useValue: {} },
        {
          provide: JwtStrategy,
          useFactory: () => {
            return new JwtStrategy(
              userService,
              mockDataSource,
              { get: jest.fn().mockReturnValue('JWT_SECRET_KEY') } as unknown as ConfigService,
            );
          },
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    clubUserController = module.get<ClubUserController>(ClubUserController);
    authService = module.get<AuthService>(AuthService);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    permissionGuard = new ClubPermissionGuard(new Reflector());
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 1: Creación de usuario recepcionista con subconjunto de permisos
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 1: debe crear un recepcionista con permisos específicos, asignado exclusivamente a su club', async () => {
    const created = await userService.createStaffUser(clubAId, {
      name: 'Carlos Recepción',
      email: 'carlos@cluba.com',
      password: rawPassword,
      permissions: ['bookings', 'payments'],
    });

    expect(created.name).toBe('Carlos Recepción');
    expect(created.email).toBe('carlos@cluba.com');
    expect(created.role).toBe(UserRole.RECEPCIONISTA);
    expect(created.assignedClubId).toBe(clubAId);
    expect(created.permissions).toEqual(['bookings', 'payments']);
    expect(created.isActive).toBe(true);
    expect(created.isVerified).toBe(true);
    expect(created.password).not.toBe(rawPassword); // Hasheado con bcrypt
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 2: Intento de IDOR (Multi-tenant isolation)
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 2 (IDOR): administrador de Club B no debe poder listar, editar ni eliminar recepcionista de Club A', async () => {
    // 1. Crear recepcionista en Club A
    const staffA = await userService.createStaffUser(clubAId, {
      name: 'Staff Club A',
      email: 'staffA@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // 2. Club B lista sus usuarios -> no debe aparecer staffA
    const clubBUsers = await userService.findStaffByClub(clubBId);
    expect(clubBUsers.some((u) => u.id === staffA.id)).toBe(false);

    // 3. Club B intenta modificar a staffA -> debe lanzar NotFoundException
    await expect(
      userService.updateStaffUser(clubBId, staffA.id, { name: 'Hackeado por Club B' }),
    ).rejects.toThrow(NotFoundException);

    // 4. Club B intenta eliminar a staffA -> debe lanzar NotFoundException
    await expect(
      userService.softDeleteStaffUser(clubBId, staffA.id),
    ).rejects.toThrow(NotFoundException);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 3: Intento de escalamiento de privilegios
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 3: intento de crear usuario forzando rol ADMIN debe restringirse estrictamente a RECEPCIONISTA', async () => {
    const maliciousDto: any = {
      name: 'Falso Admin',
      email: 'fakeadmin@cluba.com',
      password: rawPassword,
      role: 'ADMIN', // Intento de escalar privilegios por payload
      permissions: ['bookings'],
    };
    const created = await userService.createStaffUser(clubAId, maliciousDto);

    // La lógica de negocio fuerza siempre UserRole.RECEPCIONISTA
    expect(created.role).toBe(UserRole.RECEPCIONISTA);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 4: Recepcionista intenta acceder a endpoint no asignado -> 403 Forbidden
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 4: recepcionista con permiso "bookings" que intenta invocar acción de "courts" debe recibir 403 Forbidden', () => {
    const staffUser: User = {
      id: 'staff-1',
      role: UserRole.RECEPCIONISTA,
      isActive: true,
      permissions: ['bookings'],
      club: mockClubA,
    } as User;

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: staffUser }),
      }),
    } as any;

    jest.spyOn(permissionGuard['reflector'], 'getAllAndOverride').mockReturnValue('courts');

    expect(() => permissionGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    expect(() => permissionGuard.canActivate(mockContext)).toThrow(
      'No tienes permiso para acceder al apartado de courts',
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 5: Recepcionista intenta acceder a endpoint asignado -> 200 OK
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 5: recepcionista con permiso "bookings" que invoca acción de "bookings" debe ser autorizado', () => {
    const staffUser: User = {
      id: 'staff-1',
      role: UserRole.RECEPCIONISTA,
      isActive: true,
      permissions: ['bookings'],
      club: mockClubA,
    } as User;

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: staffUser }),
      }),
    } as any;

    jest.spyOn(permissionGuard['reflector'], 'getAllAndOverride').mockReturnValue('bookings');

    expect(permissionGuard.canActivate(mockContext)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 6: Recepcionista intenta acceder a /club/users -> 403 Forbidden
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 6: un usuario con rol RECEPCIONISTA que intente llamar endpoints de ClubUserController debe ser bloqueado', async () => {
    const staffUser: User = {
      id: 'staff-1',
      role: UserRole.RECEPCIONISTA,
      isActive: true,
      permissions: ['dashboard', 'bookings', 'payments'],
      assignedClubId: clubAId,
    } as User;

    await expect(clubUserController.getStaffUsers(staffUser)).rejects.toThrow(
      new ForbiddenException('Solo el administrador del club puede gestionar usuarios'),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 7: Desactivar acceso de recepcionista -> login rechazado con mensaje exacto
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 7: recepcionista con acceso desactivado debe ser rechazado en login con el mensaje dinámico del club', async () => {
    const staff = await userService.createStaffUser(clubAId, {
      name: 'Mario Bloqueado',
      email: 'mario@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // Desactivar acceso individual
    await userService.toggleStaffStatus(clubAId, staff.id, false);

    // Intentar login con credenciales correctas
    await expect(
      authService.login({
        email: 'mario@cluba.com',
        password: rawPassword,
      }),
    ).rejects.toThrow(
      new UnauthorizedException(`Tu acceso ha sido desactivado. Comunícate con el encargado de ${mockClubA.name}.`),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 8: Reactivar acceso de recepcionista -> login exitoso
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 8: reactivar acceso del recepcionista debe permitirle hacer login nuevamente sin problemas', async () => {
    const staff = await userService.createStaffUser(clubAId, {
      name: 'Mario Reactivado',
      email: 'reactivado@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // 1. Desactivar
    await userService.toggleStaffStatus(clubAId, staff.id, false);

    // 2. Reactivar
    await userService.toggleStaffStatus(clubAId, staff.id, true);

    // 3. Login debe ser exitoso
    const result = await authService.login({
      email: 'reactivado@cluba.com',
      password: rawPassword,
    });

    expect(result).toHaveProperty('access_token');
    expect(result).toHaveProperty('refresh_token');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 9: Club suspendido -> recepcionista activo bloqueado con mensaje dinámico
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 9: si el club está SUSPENDED, el recepcionista activo debe ser bloqueado con el mensaje dinámico del club', async () => {
    await userService.createStaffUser(clubAId, {
      name: 'Staff Club Suspendido',
      email: 'staffsus@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // Suspender el club A
    mockClubA.status = 'SUSPENDED';

    await expect(
      authService.login({
        email: 'staffsus@cluba.com',
        password: rawPassword,
      }),
    ).rejects.toThrow(
      new UnauthorizedException(
        `El acceso al club se encuentra temporalmente suspendido. Comunícate con el encargado de ${mockClubA.name}.`,
      ),
    );

    // Restaurar estado para siguientes pruebas
    mockClubA.status = 'APPROVED';
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 10: Club reactivado tras pago -> recepcionistas activos recuperan acceso
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 10: cuando el club vuelve a APPROVED, los recepcionistas activos recuperan acceso y los desactivados siguen bloqueados', async () => {
    // 1. Recepcionista Activo
    await userService.createStaffUser(clubAId, {
      name: 'Staff Activo',
      email: 'activo@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // 2. Recepcionista Desactivado Manualmente
    const staffDesactivado = await userService.createStaffUser(clubAId, {
      name: 'Staff Desactivado Manual',
      email: 'desactivadomanual@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });
    await userService.toggleStaffStatus(clubAId, staffDesactivado.id, false);

    // 3. Club se reactiva a APPROVED
    mockClubA.status = 'APPROVED';

    // 4. El activo inicia sesión exitosamente
    const loginActivo = await authService.login({
      email: 'activo@cluba.com',
      password: rawPassword,
    });
    expect(loginActivo).toHaveProperty('access_token');

    // 5. El desactivado manualmente continúa bloqueado con su mensaje individual
    await expect(
      authService.login({
        email: 'desactivadomanual@cluba.com',
        password: rawPassword,
      }),
    ).rejects.toThrow(
      new UnauthorizedException(`Tu acceso ha sido desactivado. Comunícate con el encargado de ${mockClubA.name}.`),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 11: Envío de correo de bienvenida al crear recepcionista
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 11: al crear un recepcionista se debe disparar sendStaffWelcomeEmail con contraseña y credenciales', async () => {
    await userService.createStaffUser(clubAId, {
      name: 'Elena Recepcionista',
      email: 'elena@cluba.com',
      password: 'MiPasswordSeguro!',
      permissions: ['bookings', 'payments'],
    });

    expect(mockMailerService.sendStaffWelcomeEmail).toHaveBeenCalledWith({
      to: 'elena@cluba.com',
      staffName: 'Elena Recepcionista',
      clubName: mockClubA.name,
      rawPassword: 'MiPasswordSeguro!',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 12: Notificaciones de reservas según permisos y estado del club
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 12: getStaffBookingEmails debe filtrar por permiso "bookings", descartar desactivados y abortar si club suspendido', async () => {
    const realMailer = new MailerService(mockDataSource);

    // Crear recepcionista con permiso 'bookings'
    await userService.createStaffUser(clubAId, {
      name: 'Staff Con Permiso',
      email: 'conpermiso@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // Crear recepcionista sin permiso 'bookings'
    await userService.createStaffUser(clubAId, {
      name: 'Staff Sin Permiso',
      email: 'sinpermiso@cluba.com',
      password: rawPassword,
      permissions: ['courts', 'schedules'],
    });

    // Crear recepcionista desactivado
    const staffDesc = await userService.createStaffUser(clubAId, {
      name: 'Staff Desactivado Con Permiso',
      email: 'descconpermiso@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });
    await userService.toggleStaffStatus(clubAId, staffDesc.id, false);

    // 1. Club aprobado -> Solo debe retornar conpermiso@cluba.com
    mockClubA.status = 'APPROVED';
    const emailsAprobado = await realMailer.getStaffBookingEmails(clubAId);
    expect(emailsAprobado).toContain('conpermiso@cluba.com');
    expect(emailsAprobado).not.toContain('sinpermiso@cluba.com');
    expect(emailsAprobado).not.toContain('descconpermiso@cluba.com');

    // 2. Club suspendido -> Debe retornar vacío
    mockClubA.status = 'SUSPENDED';
    const emailsSuspendido = await realMailer.getStaffBookingEmails(clubAId);
    expect(emailsSuspendido).toEqual([]);

    mockClubA.status = 'APPROVED';
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CASO 13: Eliminación lógica (Soft Delete)
  // ─────────────────────────────────────────────────────────────────────────────
  it('CASO 13: la eliminación debe ser lógica (poblando deletedAt e isActive = false) preservando el registro en BD', async () => {
    const staff = await userService.createStaffUser(clubAId, {
      name: 'Usuario Para Borrar',
      email: 'borrar@cluba.com',
      password: rawPassword,
      permissions: ['bookings'],
    });

    // Ejecutar eliminación
    const deleteResult = await userService.softDeleteStaffUser(clubAId, staff.id);
    expect(deleteResult).toEqual({
      success: true,
      message: 'Usuario eliminado correctamente del club',
    });

    // En la base de datos el registro aún existe con deletedAt e isActive: false
    const rawUserInDb = inMemoryUsers.find((u) => u.id === staff.id);
    expect(rawUserInDb).toBeDefined();
    expect(rawUserInDb?.isActive).toBe(false);
    expect(rawUserInDb?.deletedAt).toBeInstanceOf(Date);

    // El listado habitual del club ya no lo incluye
    const activeStaffList = await userService.findStaffByClub(clubAId);
    expect(activeStaffList.some((u) => u.id === staff.id)).toBe(false);
  });
});
