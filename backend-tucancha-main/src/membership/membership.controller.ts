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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { SubscribePlanDto } from './dto/subscribe-plan.dto';
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
}
