import { IsString, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, Min } from 'class-validator';
import { BillingInterval } from '../enums/billing-interval.enum';

export class UpdateMembershipPlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(BillingInterval)
  @IsOptional()
  interval?: BillingInterval;

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
