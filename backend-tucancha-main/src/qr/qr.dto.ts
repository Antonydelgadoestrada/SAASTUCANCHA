// src/qr/qr.dto.ts
import { IsIn, IsInt, IsOptional, IsUrl, Max, Min } from "class-validator";

export class QrQueryDto {
  @IsUrl({ protocols: ["http", "https"] })
  url!: string; // URL que quieres convertir a QR

  @IsOptional()
  @IsIn(["L", "M", "Q", "H"])
  ecLevel?: "L" | "M" | "Q" | "H" = "M";   // nivel de corrección

  @IsOptional()
  @IsInt() @Min(1) @Max(20)
  scale?: number = 8;                      // tamaño

  @IsOptional()
  @IsInt() @Min(0) @Max(8)
  margin?: number = 2;                     // borde

  @IsOptional()
  @IsIn(["png", "svg"])
  format?: "png" | "svg" = "png";          // tipo de salida
}
