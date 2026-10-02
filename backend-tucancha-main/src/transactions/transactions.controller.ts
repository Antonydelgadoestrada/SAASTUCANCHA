import { Controller, Get, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const user = req.user;
    if (!user || user.role !== 'CLUB' || !user.club) {
      throw new UnauthorizedException('Solo el rol CLUB tiene acceso a sus transacciones.');
    }
    
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    
    return this.transactionsService.findAllByClub(user.club, page, limit, startDate, endDate);
  }

  @Get('metrics')
  async getMetrics(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const user = req.user;
    if (!user || user.role !== 'CLUB' || !user.club) {
      throw new UnauthorizedException('Solo el rol CLUB tiene acceso a sus métricas de transacciones.');
    }
    
    return this.transactionsService.getMetrics(user.club, startDate, endDate);
  }
}
