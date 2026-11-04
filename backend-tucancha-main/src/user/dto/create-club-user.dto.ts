import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  ArrayUnique,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const ALLOWED_STAFF_PERMISSIONS = [
  'dashboard',
  'payments',
  'transactions',
  'schedules',
  'events',
  'courts',
  'bookings',
  'membership',
  'loyalty',
] as const;

export type StaffPermission = typeof ALLOWED_STAFF_PERMISSIONS[number];

export class CreateClubUserDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail({}, { message: 'Por favor ingresa un correo electrónico válido' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @IsArray({ message: 'Los permisos deben suministrarse en un arreglo' })
  @IsString({ each: true, message: 'Cada permiso debe ser un texto' })
  @ArrayUnique({ message: 'No se permiten permisos duplicados' })
  @IsIn(ALLOWED_STAFF_PERMISSIONS, {
    each: true,
    message: 'Uno o más permisos especificados no son válidos',
  })
  permissions: string[];
}
