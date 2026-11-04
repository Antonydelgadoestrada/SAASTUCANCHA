import {
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  ArrayUnique,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ALLOWED_STAFF_PERMISSIONS } from './create-club-user.dto';

export class UpdateClubUserDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @IsOptional()
  @IsArray({ message: 'Los permisos deben suministrarse en un arreglo' })
  @IsString({ each: true, message: 'Cada permiso debe ser un texto' })
  @ArrayUnique({ message: 'No se permiten permisos duplicados' })
  @IsIn(ALLOWED_STAFF_PERMISSIONS, {
    each: true,
    message: 'Uno o más permisos especificados no son válidos',
  })
  permissions?: string[];

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser booleano' })
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;
}
