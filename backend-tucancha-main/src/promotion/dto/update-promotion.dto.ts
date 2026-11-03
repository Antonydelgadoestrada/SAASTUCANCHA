import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdatePromotionDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID('all', { message: 'El courtId debe ser un UUID válido' })
  courtId?: string | null;

  @IsOptional()
  @IsBoolean()
  applyToAllCourts?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime debe tener formato HH:mm (ej. 10:00)',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^23:59$|^24:00$/, {
    message: 'endTime debe tener formato HH:mm (ej. 12:00)',
  })
  endTime?: string;

  @IsOptional()
  @IsArray({ message: 'daysOfWeek debe ser un arreglo de números' })
  @IsInt({ each: true, message: 'Cada día debe ser un entero (0: Dom, 1: Lun, ..., 6: Sáb)' })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsNumber({}, { message: 'El porcentaje de descuento debe ser numérico' })
  @Min(1, { message: 'El descuento mínimo permitido es 1%' })
  @Max(100, { message: 'El descuento máximo permitido es 100%' })
  discountPercentage?: number;

  @IsOptional()
  @IsDateString({}, { message: 'startDate debe ser una fecha ISO válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate debe ser una fecha ISO válida' })
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
