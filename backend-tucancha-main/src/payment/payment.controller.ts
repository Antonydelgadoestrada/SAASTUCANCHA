import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    NotFoundException,
    Query,
    Res,
    Req,
    UseGuards,
  } from '@nestjs/common';
  import { PaymentService } from './payment.service';
  import { Payment } from './payment.entity';
  import { Response } from 'express';
import { Cron } from '@nestjs/schedule';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../user/user.entity';
import { GetUser } from '../auth/get-user.decorator';
  
  @Controller('payments')
  export class PaymentController {
    constructor(private readonly service: PaymentService) {}
  
    @Get()
    findAll(): Promise<Payment[]> {
      return this.service.findAll();
    }
    // payments.controller.ts
    @Get('oauth/callback')
    async handleOAuthCallback(
      @Query('code') code: string,
      @Query('state') clubId: string,
      @Res() res: Response
    ) {
     const result = await  this.service.handleOauthCallback(code, clubId)
     return res.redirect(result.redirect)
    }

    @UseGuards(JwtAuthGuard)
    @Post('create-preference')
    async createPreference(
      @Body() dto: any,
      @GetUser() user: User
    ) {
      return this.service.createPreference(dto,user)
    }

    @UseGuards(JwtAuthGuard)
    @Post('confirmPayment')
    async confirmPayment(
      @Body() dto: any,
      @GetUser() user: User
    ) {
      return this.service.confirmPayment(dto)
    }

    @Cron('0 0 2 * * *') // A las 2:00 AM todos los días
    async updateTokens() {
      return this.service.updateToken()
    }

    @Get('authorize')
    async authorize( @Query('clubId') clubId: string,) {
      return this.service.authorize(clubId)
    }
    
    @Post('webhook')
    async webhook(@Query() query: any) {
      await this.service.handleMercadoPagoWebhook(query);
      return { received: true };
    }
  
    @Post()
    create(@Body() data: Partial<Payment>) {
      return this.service.create(data);
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Payment> {
      const payment = await this.service.findOne(id);
      if (!payment) throw new NotFoundException('Payment not found');
      return payment;
    }
  
    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Payment>) {
      return this.service.update(id, data);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.service.remove(id);
    }
  }
  