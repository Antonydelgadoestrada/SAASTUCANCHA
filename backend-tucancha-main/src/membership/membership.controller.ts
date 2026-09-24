import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage, File as MulterFile } from 'multer';
import { MembershipService } from './membership.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { SubscribePlanDto } from './dto/subscribe-plan.dto';
import { SubmitManualMembershipPaymentDto } from './dto/submit-manual-membership-payment.dto';
import { SavePlatformCredentialsDto } from './dto/save-platform-credentials.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';

@Controller('memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // Listar planes activos (público / clubes)
  @Get('plans')
  async getActivePlans() {
    return this.membershipService.findActivePlans();
  }

  // Listar todos los planes (Admin)
  @UseGuards(JwtAuthGuard)
  @Get('plans/all')
  async getAllPlans(@GetUser() user: Partial<User>) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden consultar todos los planes');
    }
    return this.membershipService.findAllPlans();
  }

  // Crear plan (Admin)
  @UseGuards(JwtAuthGuard)
  @Post('plans')
  async createPlan(
    @Body() dto: CreateMembershipPlanDto,
    @GetUser() user: Partial<User>,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden crear planes');
    }
    return this.membershipService.createPlan(dto);
  }

  // Modificar plan (Admin)
  @UseGuards(JwtAuthGuard)
  @Put('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipPlanDto,
    @GetUser() user: Partial<User>,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden modificar planes');
    }
    return this.membershipService.updatePlan(id, dto);
  }

  // Consultar membresía activa del club autenticado
  @UseGuards(JwtAuthGuard)
  @Get('my-membership')
  async getMyMembership(@GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    const membership = await this.membershipService.getClubActiveMembership(user.club.id);
    return { membership };
  }

  // Historial de membresías del club
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getMyMembershipHistory(@GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    return this.membershipService.getClubMembershipHistory(user.club.id);
  }

  // Historial de pagos de membresía del club
  @UseGuards(JwtAuthGuard)
  @Get('payments')
  async getMyPayments(@GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    return this.membershipService.getMembershipPayments(user.club.id);
  }

  // Cancelar renovación automática del club
  @UseGuards(JwtAuthGuard)
  @Post('cancel-autorenew')
  async cancelAutoRenew(@GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    return this.membershipService.cancelMembershipAutoRenew(user.club.id);
  }

  // SPRINT B: Crear preferencia de pago de membresía en Mercado Pago
  @UseGuards(JwtAuthGuard)
  @Post('checkout-preference')
  async createCheckoutPreference(
    @Body() body: SubscribePlanDto,
    @GetUser() user: Partial<User>,
  ) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    return this.membershipService.createMembershipPreference(
      user.club.id,
      body.planId,
      body.autoRenew !== false,
    );
  }

  // SPRINT B: Webhook exclusivo para pagos de membresías
  @Post('webhook')
  async handleMembershipWebhook(@Query() query: any, @Body() body: any) {
    await this.membershipService.handleMembershipWebhook(query, body);
    return { received: true };
  }

  // SPRINT B: Verificar estado del pago tras retorno de Mercado Pago
  @UseGuards(JwtAuthGuard)
  @Get('check-status/:paymentId')
  async checkPaymentStatus(
    @Param('paymentId') paymentId: string,
    @GetUser() user: Partial<User>,
  ) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    return this.membershipService.checkPaymentStatus(paymentId, user.club.id);
  }

  // Registrar pago manual (Yape, Plin, Transferencia con comprobante) y reactivar cuenta
  @UseGuards(JwtAuthGuard)
  @Post('manual-payment')
  @UseInterceptors(FileInterceptor('comprobante', { storage: memoryStorage() }))
  async submitManualPayment(
    @Body() body: SubmitManualMembershipPaymentDto,
    @UploadedFile() file: MulterFile,
    @GetUser() user: Partial<User>,
  ) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible para este usuario');
    }
    return this.membershipService.submitManualPayment(user.club.id, body, file);
  }

  // ADMIN: Listado de clientes y control de membresías
  @UseGuards(JwtAuthGuard)
  @Get('admin/clients')
  async getAdminClients(
    @Query('search') search: string,
    @Query('filter') filter: string,
    @GetUser() user: Partial<User>,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden consultar el listado de clientes');
    }
    return this.membershipService.getAdminClients(search, filter);
  }

  // ADMIN: Gestor de pagos y transacciones de membresías (Mercado Pago)
  @UseGuards(JwtAuthGuard)
  @Get('admin/payments')
  async getAdminPayments(
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @GetUser() user: Partial<User>,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden consultar el gestor de pagos');
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.membershipService.getAdminMembershipPayments(search, status, pageNum, limitNum);
  }

  // ----------------------------------------------------
  // ADMIN: Configuración y Conexión de Mercado Pago (Plataforma)
  // ----------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Get('admin/mercadopago/status')
  async getAdminMercadoPagoStatus(@GetUser() user: Partial<User>) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden consultar el estado de Mercado Pago');
    }
    return this.membershipService.getPlatformMercadoPagoStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/mercadopago/authorize')
  async getAdminMercadoPagoAuthorizeUrl(@GetUser() user: Partial<User>) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden iniciar vinculación de Mercado Pago');
    }
    const url = await this.membershipService.getAdminAuthorizeUrl(user.id);
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/mercadopago/disconnect')
  async disconnectAdminMercadoPago(@GetUser() user: Partial<User>) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden desconectar la cuenta de Mercado Pago');
    }
    return this.membershipService.disconnectPlatformMercadoPago(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/mercadopago/sync')
  async syncAdminMercadoPago(@GetUser() user: Partial<User>) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden probar la conexión de Mercado Pago');
    }
    return this.membershipService.syncPlatformMercadoPago();
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/mercadopago/manual-credentials')
  async saveAdminManualCredentials(
    @Body() dto: SavePlatformCredentialsDto,
    @GetUser() user: Partial<User>,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden configurar credenciales manuales');
    }
    return this.membershipService.savePlatformManualCredentials(dto, user.id);
  }
}

