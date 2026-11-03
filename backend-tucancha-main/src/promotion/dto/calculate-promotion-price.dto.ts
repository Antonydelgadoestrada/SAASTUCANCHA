import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CalculatePromotionPriceDto {
  @IsUUID('all', { message: 'El courtId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El courtId es obligatorio' })
  courtId: string;

  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  date: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime debe tener formato HH:mm (ej. 10:00)',
  })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  startTime: string;

  @IsNumber({}, { message: 'La duración debe ser un número en horas' })
  @Min(0.5, { message: 'La duración mínima es de 0.5 horas (30 minutos)' })
  @Max(24, { message: 'La duración máxima permitida es de 24 horas' })
  duration: number;
}
