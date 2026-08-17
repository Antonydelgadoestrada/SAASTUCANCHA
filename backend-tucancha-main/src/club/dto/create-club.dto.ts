import {
    IsString,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsArray,
    IsEnum,
    IsObject,
    ValidateNested,
    IsDefined,
    IsIn,
    IsNumber,
  } from 'class-validator';
  import { Type, Expose } from 'class-transformer';
  
  export class CoordinatesDto {
    @IsNumber()
    @IsDefined()
    lat: number;
  
    @IsNumber()
    @IsDefined()
    lng: number;
  }
  
  export class OperatingHourDto {
    @IsString()
    open: string;
  
    @IsString()
    close: string;
  
    @IsDefined()
    closed: boolean;
  }
  
  export class SocialMediaDto {
    @IsOptional()
    @IsString()
    facebook?: string;
  
    @IsOptional()
    @IsString()
    instagram?: string;
  
    @IsOptional()
    @IsString()
    twitter?: string;
  }
  
  export class CreateClubDto {
    @IsNotEmpty()
    @IsString()
    name: string;
  
    @IsEmail()
    email: string;
  
    @IsNotEmpty()
    @IsString()
    phone: string;
  
    @IsNotEmpty()
    @IsString()
    address: string;
  
    @IsOptional()
    @IsString()
    district?: string;
  
    @IsNotEmpty()
    @IsString()
    description: string;
  
    @IsOptional()
    @IsString()
    logo?: string;
  
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    images?: string[];
  
    @IsOptional()
    @ValidateNested()
    @Type(() => SocialMediaDto)
    socialMedia?: SocialMediaDto;
  
    @IsOptional()
    @ValidateNested()
    @Type(() => CoordinatesDto)
    coordinates?: CoordinatesDto;
  
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    services?: string[];
  
    @IsOptional()
    @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  }
  
  // club/dto/club-public.dto.ts


export class ClubPublicDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() email: string;
  @Expose() phone: string;
  @Expose() address: string;
  @Expose() district: string;
  @Expose() description: string;
  @Expose() logo?: string;
  @Expose() images: string[];
  @Expose() socialMedia?: any;
  @Expose() coordinates: { lat: number; lng: number };
  @Expose() services: string[];
  @Expose() status: string;
  @Expose() approvedAt?: Date;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
