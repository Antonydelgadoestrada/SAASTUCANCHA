import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class SubscribePlanDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;
}
