import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateLoyaltyConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(['A', 'B'])
  mode?: 'A' | 'B';

  @IsOptional()
  @IsInt()
  @Min(0)
  dayPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  nightPoints?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'nightStartsAt debe tener el formato HH:mm (ejemplo 18:00)',
  })
  nightStartsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bonusEveryX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusPoints?: number;
}
