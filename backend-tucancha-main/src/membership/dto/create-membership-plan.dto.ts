import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, Min } from 'class-validator';
import { BillingInterval } from '../enums/billing-interval.enum';

export class CreateMembershipPlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(BillingInterval)
  @IsNotEmpty()
  interval: BillingInterval;

  @IsNumber()
  @IsOptional()
  @Min(0)
  graceDays?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxCourts?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
