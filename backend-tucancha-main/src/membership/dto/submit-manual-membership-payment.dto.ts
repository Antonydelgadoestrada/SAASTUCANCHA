import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitManualMembershipPaymentDto {
  @IsNotEmpty({ message: 'El planId es requerido' })
  @IsString()
  planId: string;

  @IsNotEmpty({ message: 'El método de pago es requerido (YAPE, PLIN, TRANSFERENCIA, etc.)' })
  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
