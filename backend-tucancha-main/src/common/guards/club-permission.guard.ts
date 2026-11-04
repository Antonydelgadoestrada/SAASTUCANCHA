import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { UserRole } from '../../user/user-role.enum';
import { StaffPermission } from '../../user/dto/create-club-user.dto';

@Injectable()
export class ClubPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<StaffPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no se requiere ningún permiso específico, permitir paso
    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // 1. El rol ADMIN de plataforma siempre tiene autorización total
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // 2. El dueño del club (rol CLUB) tiene acceso a todos los componentes del club
    if (user.role === UserRole.CLUB) {
      return true;
    }

    // 3. Para rol RECEPCIONISTA, verificar si el acceso está activo y posee el permiso requerido
    if (user.role === UserRole.RECEPCIONISTA) {
      if (user.isActive === false) {
        throw new ForbiddenException('Acceso desactivado por el administrador del club');
      }

      const club = user.club || user.assignedClub;
      if (club && club.status !== 'APPROVED') {
        const clubName = club.name || 'tu club';
        throw new ForbiddenException(
          `El acceso al club se encuentra temporalmente suspendido. Comunícate con el encargado de ${clubName}.`,
        );
      }

      const permissions: string[] = user.permissions || [];
      if (!permissions.includes(requiredPermission)) {
        throw new ForbiddenException(
          `No tienes permiso para acceder al apartado de ${requiredPermission}`,
        );
      }
      return true;
    }

    throw new ForbiddenException('Rol no autorizado para acceder a este recurso');
  }
}
