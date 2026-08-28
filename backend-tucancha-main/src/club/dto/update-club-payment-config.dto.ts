import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class UpdateClubPaymentConfigDto {
  @IsOptional()
  @IsBoolean()
  aceptaMercadopago?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  whatsapp?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  yapeNumero?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  yapeQrUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  plinNumero?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  plinQrUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0, { message: 'El porcentaje de adelanto no puede ser negativo' })
  @Max(100, { message: 'El porcentaje de adelanto no puede ser mayor a 100' })
  porcentajeAdelantoDefault?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0, { message: 'El adelanto mínimo no puede ser negativo' })
  adelantoMinimo?: number | null;
}
