import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class CreateStaffDto {
  @IsNotEmpty({ message: 'El nombre es requerido y no puede estar vacío' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  name: string;

  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  @IsEmail({}, { message: 'Por favor ingresa un correo electrónico válido' })
  email: string;

  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsEnum(UserRole, { message: 'El rol especificado no es válido' })
  role: UserRole;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
