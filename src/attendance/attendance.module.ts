import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEntity } from 'src/entities/attendance.entity';
import { StudentEntity } from 'src/entities/student.entity';
import { ClassEntity } from 'src/entities/class.entity';
import { ClassSessionEntity } from 'src/entities/class-session.entity';
import { HolidayEntity } from 'src/entities/holidays.entity';

@Module({
  providers: [AttendanceService],
  controllers: [AttendanceController],
  imports: [
    TypeOrmModule.forFeature([
      AttendanceEntity,
      StudentEntity,
      ClassEntity,
      ClassSessionEntity,
      HolidayEntity,
    ]),
  ],
  exports: [AttendanceService], // Export AttendanceService if needed in other modules
})
export class AttendanceModule {}
