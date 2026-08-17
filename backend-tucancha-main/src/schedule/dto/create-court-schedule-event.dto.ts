import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsIn,
  IsUUID,
  ValidateNested,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class TimeRangeDto {
  @IsString()
  @IsNotEmpty()
  start: string;

  /** Legacy body `{ end }` (whitelist lo conserva si está declarado). */
  @IsOptional()
  @IsString()
  end?: string;

  /** Fin exclusivo (HH:mm). Se rellena desde `until` o desde `end`. */
  @Transform(({ obj }) => {
    const u = obj?.until;
    const e = obj?.end;
    if (u != null && String(u).trim() !== '') return String(u).trim();
    if (e != null && String(e).trim() !== '') return String(e).trim();
    return u;
  })
  @IsString()
  @IsNotEmpty()
  until: string;
}

export class CreateCourtScheduleEventDto {
  @IsUUID()
  courtId: string;

  @IsOptional()
  @IsUUID()
  templateId?: string | null;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['weekly', 'monthly', 'custom'])
  recurrenceType: 'weekly' | 'monthly' | 'custom';

  @IsObject()
  recurrenceConfig: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  timeRanges: TimeRangeDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
