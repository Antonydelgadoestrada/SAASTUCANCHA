import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';

@Global() // Esto hace que no tengas que importar este módulo en todos lados
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class AwsModule {}
