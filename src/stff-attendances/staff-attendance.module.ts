import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffAttendanceEntity } from '../entities/staff-attendance.entity';
import { StaffEntity } from '../entities/staff.entity';
import { StaffAttendanceService } from './staff-attendance.service';
import { StaffAttendanceController } from './staff-attendance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StaffAttendanceEntity, StaffEntity])],
  controllers: [StaffAttendanceController],
  providers: [StaffAttendanceService],
})
export class StaffAttendanceModule {}
