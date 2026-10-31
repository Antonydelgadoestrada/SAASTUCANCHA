import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClubPermissionGuard } from './club-permission.guard';
import { UserRole } from '../../user/user-role.enum';

describe('ClubPermissionGuard (FASE 3 - RBAC & Permissions)', () => {
  let guard: ClubPermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ClubPermissionGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('permite el acceso si la ruta no exige ningún permiso', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: UserRole.RECEPCIONISTA });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite acceso total al rol ADMIN sin importar permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('bookings');
    const context = createMockContext({ role: UserRole.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite acceso total al rol CLUB (propietario) sin importar permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('payments');
    const context = createMockContext({ role: UserRole.CLUB });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite acceso al rol RECEPCIONISTA si tiene el permiso asignado y está activo', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('bookings');
    const context = createMockContext({
      role: UserRole.RECEPCIONISTA,
      isActive: true,
      permissions: ['bookings', 'payments'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza ForbiddenException al rol RECEPCIONISTA si no tiene el permiso asignado', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('courts');
    const context = createMockContext({
      role: UserRole.RECEPCIONISTA,
      isActive: true,
      permissions: ['bookings', 'payments'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'No tienes permiso para acceder al apartado de courts',
    );
  });

  it('lanza ForbiddenException si el recepcionista tiene isActive = false', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('bookings');
    const context = createMockContext({
      role: UserRole.RECEPCIONISTA,
      isActive: false,
      permissions: ['bookings'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Acceso desactivado por el administrador del club',
    );
  });

  it('lanza ForbiddenException para otros roles no autorizados (ej: USER)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('bookings');
    const context = createMockContext({
      role: UserRole.USER,
      permissions: ['bookings'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Rol no autorizado para acceder a este recurso');
  });

  it('lanza ForbiddenException si no hay usuario autenticado en el request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('bookings');
    const context = createMockContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Usuario no autenticado');
  });
});
