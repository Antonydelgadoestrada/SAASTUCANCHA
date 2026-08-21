import { Controller, Get, Post, Param, Body, NotFoundException, Query, UseGuards, Put } from '@nestjs/common'
import { ScheduleTemplateService } from './schedule-template.service'
import { CreateScheduleTemplateDto } from './dto/create-schedule-template.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { GetUser } from '../auth/get-user.decorator'
import { User } from '../user/user.entity'
import { ScheduleTemplate } from './schedule_template.entity'
import { Cron, CronExpression } from '@nestjs/schedule';
@Controller('schedule-templates')
export class ScheduleTemplateController {
  constructor(private readonly templateService: ScheduleTemplateService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getTemplates(@GetUser() user: Partial<User>) {
    return this.templateService.findAllByClub(user.club.id)
  }

  @Get('court-schedule')
  async getCourtAvailability(
    @Query('courtId') courtId: string,
    @Query('startDate') start: string,
    @Query('endDate') end: string
  ) {
    return this.templateService.getAvailabilityByCourtAndDates(courtId, start, end)
  }

  @Get('by-court/:courtId')
  async getTemplateByCourtId(@Param('courtId') courtId: string) {
    return this.templateService.getTemplateByCourtId(courtId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('bulk-update')
  async bulkUpdate(@Body() body: any, @GetUser() user: Partial<User>) {
    if (!user?.club?.id) {
      throw new NotFoundException('Club no disponible');
    }
    return this.templateService.bulkUpdate(body.items, user.club.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: CreateScheduleTemplateDto, @GetUser() user: Partial<User>) {
    body.clubId = user.club.id
    return this.templateService.create(body)
  }


  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Body() data: Partial<ScheduleTemplate>,
    @Param('id') id: string,
    @GetUser() user: Partial<User>,
  ) {
    if (!user?.club?.id) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    const template = await this.templateService.findOneWithClub(id);
    if (!template?.club?.id || template.club.id !== user.club.id) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return await this.templateService.update(id, data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const template = await this.templateService.findOne(id)
    if (!template) throw new NotFoundException('Plantilla no encontrada')
    return template
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // se ejecuta todos los días a medianoche
  async applyTemplatesCron() {
    const totalCreated = await this.templateService.applyTemplateCron();
    console.log(`[CRON] Plantillas aplicadas. Total horarios nuevos creados: ${totalCreated}`);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applyTemplateToCourts')
  async applyTemplateToCourts(@Body() body:any, @GetUser() user: Partial<User>) {
    if(!user.club) return ``
    body.club = {id: user.club.id}
    // Ya no se materializan slots; se mantiene endpoint por compatibilidad.
    await this.templateService.applyTemplateToCourts(body)
    return 'OK'
  }
  @UseGuards(JwtAuthGuard)
  @Post('/applyTemplateToCourtSafe')
  async applyTemplateToCourtSafe(
    @Body() data: any
  ){
   return await this.templateService.applyTemplateToCourtSafe(data.template, data.court)
  }


}
