import { Controller, Get, Post, Query, Body, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { PaymentService } from './payment/payment.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get()
  async getHello() {
    return this.appService.getHello();
  }

  @Get('webhook')
  async webhookPing() {
    return {
      status: 'ok',
      service: 'MercadoPago Webhook (Root)',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @HttpCode(200)
  async rootWebhook(@Query() query: any, @Body() body: any) {
    return await this.paymentService.handleMercadoPagoWebhook(query, body);
  }

  @Post()
  @HttpCode(200)
  async rootPost(@Query() query: any, @Body() body: any) {
    return await this.paymentService.handleMercadoPagoWebhook(query, body);
  }
}

