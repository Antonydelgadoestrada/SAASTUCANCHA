import { IsOptional, IsString, IsArray, IsBoolean, IsNumber, IsObject } from 'class-validator';

export class UpdateCourtScheduleEventDto {
  @IsOptional()
  @IsString()
  courtId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  recurrenceType?: string;

  @IsOptional()
  @IsObject()
  recurrenceConfig?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  timeRanges?: any[];

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
