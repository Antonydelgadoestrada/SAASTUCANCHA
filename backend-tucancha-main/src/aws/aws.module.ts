import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { MediaController } from './media.controller';

@Global()
@Module({
  controllers: [MediaController],
  providers: [S3Service],
  exports: [S3Service],
})
export class AwsModule {}
