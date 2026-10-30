import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PreviewCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de cupón es obligatorio' })
  code: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsString()
  @IsNotEmpty({ message: 'La cancha es obligatoria' })
  courtId: string;

  @IsNumber({}, { message: 'El precio base debe ser numérico' })
  @Min(0, { message: 'El precio base no puede ser negativo' })
  basePrice: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  bookingDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string;
}


