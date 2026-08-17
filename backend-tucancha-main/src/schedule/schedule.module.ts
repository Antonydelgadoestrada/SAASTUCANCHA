import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleTemplate } from './schedule_template.entity';
import { CourtScheduleAvailability } from './court_schedule_availability.entity';
import { CourtScheduleEvent } from './court_schedule_event.entity';
import { ScheduleTemplateService } from './schedule-template.service';
import { ScheduleTemplateController } from './schedule-template.controller';
import { CourtScheduleEventService } from './court-schedule-event.service';
import { CourtScheduleEventController } from './court-schedule-event.controller';
import { CourtModule } from '../court/court.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleTemplate,
      CourtScheduleAvailability,
      CourtScheduleEvent,
    ]),
    CourtModule,
  ],
  providers: [ScheduleTemplateService, CourtScheduleEventService],
  controllers: [ScheduleTemplateController, CourtScheduleEventController],
  exports: [ScheduleTemplateService, CourtScheduleEventService],
})
export class ScheduleCalendarModule {}
