import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class UpdateClubPaymentConfigDto {
  @IsOptional()
  @IsBoolean()
  aceptaMercadopago?: boolean;

  @IsOptional()
  @IsString()
  yapeNumero?: string;

  @IsOptional()
  @IsString()
  yapeQrUrl?: string;

  @IsOptional()
  @IsString()
  plinNumero?: string;

  @IsOptional()
  @IsString()
  plinQrUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El porcentaje de adelanto no puede ser negativo' })
  @Max(100, { message: 'El porcentaje de adelanto no puede ser mayor a 100' })
  porcentajeAdelantoDefault?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El adelanto mínimo no puede ser negativo' })
  adelantoMinimo?: number;
}
