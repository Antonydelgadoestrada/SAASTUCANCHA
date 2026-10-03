import { Controller, Get, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('admin/backfill')
  async backfill() {
    return this.transactionsService.backfillOldPayments();
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('category') category?: string,
  ) {
    const user = req.user;
    if (!user || user.role !== 'CLUB' || !user.club) {
      throw new UnauthorizedException('Solo el rol CLUB tiene acceso a sus transacciones.');
    }
    
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    
    const clubId = typeof user.club === 'string' ? user.club : user.club?.id || user.club;
    return this.transactionsService.findAllByClub(clubId, page, limit, startDate, endDate, status, paymentMethod, category);
  }

  @Get('metrics')
  async getMetrics(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('category') category?: string,
  ) {
    const user = req.user;
    if (!user || user.role !== 'CLUB' || !user.club) {
      throw new UnauthorizedException('Solo el rol CLUB tiene acceso a sus métricas de transacciones.');
    }
    
    const clubId = typeof user.club === 'string' ? user.club : user.club?.id || user.club;
    return this.transactionsService.getMetrics(clubId, startDate, endDate, paymentMethod, category);
  }
}
