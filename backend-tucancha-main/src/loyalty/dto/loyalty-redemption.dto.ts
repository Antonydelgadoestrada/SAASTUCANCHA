import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RedeemRewardDto {
  @IsUUID('4', { message: 'rewardId debe ser un UUID válido' })
  @IsNotEmpty()
  rewardId: string;
}

export class DeliverRewardDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de canje es requerido' })
  code: string;
}

export class RejectRedemptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Debe especificar el motivo del rechazo' })
  reason: string;
}
