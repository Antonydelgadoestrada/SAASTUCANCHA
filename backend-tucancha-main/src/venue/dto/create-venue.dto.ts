// src/venue/dto/create-venue.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsNumber,
  IsArray,
  IsDefined,
} from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsDefined() // mejor que IsNotEmpty para números
  clubId: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  @IsNotEmpty()
  capacity: string;

  @IsOptional()
  @IsString()
  parkingSpots?: string;

  @IsString()
  @IsNotEmpty()
  openingHours: string;

  @IsArray()
  @IsString({ each: true })
  services: string[];

  @IsOptional()
  @IsString()
  accessibilityFeatures?: string;

  @IsOptional()
  @IsString()
  nearbyTransport?: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
