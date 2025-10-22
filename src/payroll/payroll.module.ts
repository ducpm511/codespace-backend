import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { StaffAttendanceEntity } from '../entities/staff-attendance.entity';
import { StaffScheduleEntity } from '../entities/staff-schedule.entity';
import { StaffEntity } from '../entities/staff.entity';
import { OtRequestEntity } from 'src/entities/ot-request.entity';
import { ShiftEntity } from 'src/entities/shift.entity';
import { ClassSessionEntity } from 'src/entities/class-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffAttendanceEntity,
      StaffScheduleEntity,
      StaffEntity,
      OtRequestEntity,
      ShiftEntity,
      ClassSessionEntity,
    ]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
