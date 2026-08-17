import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';

@Module({
  imports: [],
  providers: [],
  controllers: [QrController],
  exports: [],
})
export class QrModule {}
