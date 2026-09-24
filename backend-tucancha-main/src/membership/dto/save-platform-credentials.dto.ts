import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SavePlatformCredentialsDto {
  @IsString()
  @IsNotEmpty({ message: 'El Access Token es obligatorio' })
  accessToken: string;

  @IsString()
  @IsOptional()
  publicKey?: string;
}
