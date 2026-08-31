import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from './booking-status.enum';
import { PaymentStatus } from '../payment/payment-status.enum';

class CustomerInfoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class PricingDto {
  @IsNumber()
  basePrice: number;

  @IsNumber()
  discounts: number;

  @IsNumber()
  taxes: number;

  @IsNumber()
  totalPrice: number;
}

export class CreateBookingDto {
  @IsOptional()
  @IsDateString()
  date?: Date;

  @IsOptional()
  dates?: Date[];

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsNumber()
  duration: number;

  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customerInfo: CustomerInfoDto;

  @ValidateNested()
  @Type(() => PricingDto)
  pricing: PricingDto;

  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  bookingReference: string;

  @IsString()
  userId: string;

  @IsString()
  courtId: string;

  @IsString()
  clubId: string;
}

export class CreateManualBookingDto {
  @IsString()
  courtId: string;

  @IsOptional()
  @IsDateString()
  date?: Date;

  @IsOptional()
  dates?: Date[];

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsString()
  duration: number;

  @IsString()
  price: string;

  @IsEmail()
  userEmail:string;

  @IsOptional()
  @IsString()
  proofOfPaymentUrl?: string;

  @ValidateNested()
  @IsOptional()
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    notes?: string;
  }

  @ValidateNested()
  @IsOptional()
  pricing:string
  // pricing: {
  //   basePrice: number;
  //   discounts: number;
  //   taxes: number;
  //   totalPrice: number;
  // }
}
