import { SetMetadata } from '@nestjs/common';
import { StaffPermission } from '../../user/dto/create-club-user.dto';

export const PERMISSION_KEY = 'club_permission';

/**
 * Decorador para exigir un permiso específico del panel a roles secundarios (RECEPCIONISTA).
 * Los roles ADMIN y CLUB (dueño) omiten automáticamente esta verificación.
 */
export const RequirePermission = (permission: StaffPermission) =>
  SetMetadata(PERMISSION_KEY, permission);
