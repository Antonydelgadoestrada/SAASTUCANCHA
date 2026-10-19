import { IsEmail, IsOptional, IsString, MinLength, IsEnum } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class UpdateStaffDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Por favor ingresa un correo electrónico válido' })
  email?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol especificado no es válido' })
  role?: UserRole;

  @IsOptional()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;
}
