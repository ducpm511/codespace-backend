import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffScheduleEntity } from '../entities/staff-schedule.entity';
import { StaffSchedulesController } from './staff-schedules.controller';
import { StaffSchedulesService } from './staff-schedules.service';
import { ClassSessionEntity } from '../entities/class-session.entity';
import { ShiftEntity } from 'src/entities/shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffScheduleEntity,
      ClassSessionEntity,
      ShiftEntity,
    ]),
  ],
  controllers: [StaffSchedulesController],
  providers: [StaffSchedulesService],
})
export class StaffSchedulesModule {}
