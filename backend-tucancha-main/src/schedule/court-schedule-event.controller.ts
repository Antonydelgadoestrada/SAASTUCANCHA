import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { CourtScheduleEventService } from './court-schedule-event.service';
import { CreateCourtScheduleEventDto } from './dto/create-court-schedule-event.dto';
import { UpdateCourtScheduleEventDto } from './dto/update-court-schedule-event.dto';

@Controller('court-schedule-events')
export class CourtScheduleEventController {
  constructor(private readonly courtScheduleEventService: CourtScheduleEventService) {}

  @UseGuards(JwtAuthGuard)
  @Get('court/:courtId/list')
  async listByCourt(@Param('courtId') courtId: string, @GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible');
    }
    return this.courtScheduleEventService.listByCourt(courtId, user.club.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreateCourtScheduleEventDto, @GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible');
    }
    return this.courtScheduleEventService.create(dto, user.club.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':eventId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCourtScheduleEventDto,
    @GetUser() user: Partial<User>,
  ) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible');
    }
    return this.courtScheduleEventService.update(eventId, dto, user.club.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':eventId')
  async remove(@Param('eventId') eventId: string, @GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible');
    }
    await this.courtScheduleEventService.deleteById(eventId, user.club.id);
    return { ok: true };
  }

  /**
   * Slots virtuales `status: event` para el rango [startDate, endDate] (YYYY-MM-DD).
   * Cada ítem: `time` = inicio de celda 30 min; `slotEnd` = fin de esa celda; `rangeStart`/`rangeUntil` = rango del evento (until exclusivo).
   * Se combinan en el front con plantilla + overrides de disponibilidad.
   */
  @UseGuards(JwtAuthGuard)
  @Get('court/:courtId')
  async expandForCourt(
    @Param('courtId') courtId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @GetUser() user: Partial<User>,
  ) {
    if (!user?.club?.id) {
      throw new ForbiddenException('Club no disponible');
    }
    if (!startDate || !endDate) {
      return [];
    }
    return this.courtScheduleEventService.expandForCourt(
      courtId,
      startDate,
      endDate,
      user.club.id,
    );
  }
}
