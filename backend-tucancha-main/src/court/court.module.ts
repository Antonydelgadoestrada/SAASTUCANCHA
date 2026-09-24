import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Court } from './court.entity';
import { CourtService } from './court.service';
import { CourtController } from './court.controller';
import { AwsModule } from '../aws/aws.module';
import { ScheduleTemplate } from '../schedule/schedule_template.entity';
import { CourtScheduleAvailability } from '../schedule/court_schedule_availability.entity';

import { Club } from '../club/club.entity';
import { ScheduleCalendarModule } from '../schedule/schedule.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Court, ScheduleTemplate, CourtScheduleAvailability, Club]),
    AwsModule,
    forwardRef(() => ScheduleCalendarModule),
  ],
  providers: [CourtService],
  controllers: [CourtController],
  exports: [CourtService],
})
export class CourtModule {}
