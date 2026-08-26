import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Param,
    Body,
    NotFoundException,
    Query,
    Res,
    Req,
    UseGuards,
    UseInterceptors,
    UploadedFile,
  } from '@nestjs/common';
  import { PaymentService } from './payment.service';
  import { Payment } from './payment.entity';
  import { Response } from 'express';
import { Cron } from '@nestjs/schedule';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../user/user.entity';
import { GetUser } from '../auth/get-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage, File as MulterFile } from 'multer';
  
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
    async authorize(
      @Query('clubId') clubId: string,
      @Res() res: Response,
      @Req() req: any,
    ) {
      const url = await this.service.authorize(clubId);
      const isHtmlRequest = req.headers?.accept?.includes('text/html');
      if (isHtmlRequest) {
        return res.redirect(url);
      }
      return res.json({ url });
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

    // ─── ENDPOINTS DEL CLUB (Métricas, Lista, Auditoría, Comprobante) ─────

    /**
     * GET /payments/club/metrics
     * Devuelve KPIs de recaudación del club autenticado
     */
    @UseGuards(JwtAuthGuard)
    @Get('club/metrics')
    async getMetrics(
      @GetUser() user: User,
      @Query('clubId') clubId?: string,
    ) {
      return this.service.getClubPaymentMetrics(user, clubId);
    }

    /**
     * GET /payments/club/list
     * Devuelve lista de pagos filtrada para el club autenticado
     */
    @UseGuards(JwtAuthGuard)
    @Get('club/list')
    async getList(
      @GetUser() user: User,
      @Query('status') status?: string,
      @Query('method') method?: string,
      @Query('type') type?: string,
      @Query('search') search?: string,
    ) {
      return this.service.getClubPaymentsList(user, { status, method, type, search });
    }

    /**
     * PATCH & PUT /payments/:id/confirm
     * Auditar comprobante — Confirmar o Rechazar un pago manual
     */
    @UseGuards(JwtAuthGuard)
    @Put(':id/confirm')
    async auditPayment(
      @Param('id') id: string,
      @Body() dto: { action: 'CONFIRMAR' | 'RECHAZAR'; motivoRechazo?: string },
      @GetUser() user: User,
    ) {
      return this.service.auditManualPayment(id, dto.action, user, dto.motivoRechazo);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/confirm')
    async auditPaymentPatch(
      @Param('id') id: string,
      @Body() dto: { action: 'CONFIRMAR' | 'RECHAZAR'; motivoRechazo?: string },
      @GetUser() user: User,
    ) {
      return this.service.auditManualPayment(id, dto.action, user, dto.motivoRechazo);
    }

    /**
     * POST /payments/upload-comprobante
     * Subida de imagen de comprobante de pago por el usuario a S3
     */
    @UseGuards(JwtAuthGuard)
    @Post('upload-comprobante')
    @UseInterceptors(
      FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
      }),
    )
    async uploadComprobante(@UploadedFile() file: MulterFile) {
      return this.service.uploadReceiptFile(file);
    }

    /**
     * POST /payments/booking/:id
     * Registrar pago manual (Yape / Plin) con comprobante para una reserva
     */
    @UseGuards(JwtAuthGuard)
    @Post('booking/:id')
    async createBookingPayment(
      @Param('id') bookingId: string,
      @Body() dto: any,
      @GetUser() user: User,
    ) {
      return this.service.createBookingManualPayment({ ...dto, bookingId }, user);
    }

    /**
     * GET /payments/booking/:id
     * Obtener historial de pagos de una reserva
     */
    @UseGuards(JwtAuthGuard)
    @Get('booking/:id')
    async getBookingPayments(
      @Param('id') bookingId: string,
    ) {
      return this.service.getPaymentsByBooking(bookingId);
    }
  }
  