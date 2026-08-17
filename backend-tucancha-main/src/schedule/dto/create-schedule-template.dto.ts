import { IsString, IsOptional, IsArray, IsEnum, ValidateNested, IsNotEmpty, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

export class SlotDto {
  @IsString()
  @IsNotEmpty()
  time: string

  @IsEnum(['available', 'blocked'], {
    message: "El estado debe ser 'available' o 'blocked'",
  })
  status: 'available' | 'blocked'
}

export class CreateScheduleTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsArray()
  @IsString({ each: true })
  days: string[] // Ejemplo: ['monday', 'wednesday', 'friday']

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots: SlotDto[]

  @IsString()
  clubId: string

  @IsOptional()
  @IsNumber()
  venueId?: number // null si aplica a todas las sedes
}

export class UpdateScheduleTemplateDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEnum(['available', 'blocked'], {
    message: "El estado debe ser 'available' o 'blocked'",
  })
  status: 'available' | 'blocked' | 'occupied';
}