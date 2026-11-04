import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LoyaltyRewardType } from '../enums/loyalty-reward-type.enum';

export class CreateLoyaltyRewardDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1, { message: 'El costo en puntos debe ser al menos 1' })
  pointsCost: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(LoyaltyRewardType, { message: 'Tipo de premio inválido' })
  rewardType?: LoyaltyRewardType;

  @IsOptional()
  @IsNumber({}, { message: 'El valor de descuento debe ser numérico' })
  @Min(0, { message: 'El valor de descuento no puede ser negativo' })
  discountValue?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El tope máximo de descuento debe ser numérico' })
  @Min(0, { message: 'El tope máximo de descuento no puede ser negativo' })
  maxDiscountAmount?: number;
}

export class UpdateLoyaltyRewardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El costo en puntos debe ser al menos 1' })
  pointsCost?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(LoyaltyRewardType, { message: 'Tipo de premio inválido' })
  rewardType?: LoyaltyRewardType;

  @IsOptional()
  @IsNumber({}, { message: 'El valor de descuento debe ser numérico' })
  @Min(0, { message: 'El valor de descuento no puede ser negativo' })
  discountValue?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El tope máximo de descuento debe ser numérico' })
  @Min(0, { message: 'El tope máximo de descuento no puede ser negativo' })
  maxDiscountAmount?: number;
}
