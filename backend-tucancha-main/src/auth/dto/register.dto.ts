// src/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../user/user-role.enum';
import { CreateClubDto } from '../../club/dto/create-club.dto';
// import { CreateClubDto } from '/club/dto/create-club.dto';

class ClubInfoDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  address?: string;

  @IsOptional()
  city?: string;

  @IsOptional()
  state?: string;

  @IsOptional()
  zipCode?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  logo?: string;

  @IsOptional()
  images?: string[];

  @IsOptional()
  socialMedia?: {
    facebook?: string;
    instagram?: string;
  };

  @IsOptional()
  coordinates?: {
    lat: number;
    lng: number;
  };

  @IsOptional()
  amenities?: string[];
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsIn([UserRole.USER, UserRole.CLUB], { message: 'El rol permitido para registro es USER o CLUB' })
  role: UserRole;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClubDto)
  club?: CreateClubDto;
}
