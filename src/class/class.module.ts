import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from 'src/entities/class.entity';
import { AttendanceModule } from '../attendance/attendance.module'; // <-- Import AttendanceModule
import { ClassSessionEntity } from 'src/entities/class-session.entity';
import { HolidayEntity } from 'src/entities/holidays.entity';
import { StudentEntity } from 'src/entities/student.entity';
import { AttendanceEntity } from 'src/entities/attendance.entity';

@Module({
  providers: [ClassesService],
  controllers: [ClassesController],
  imports: [
    TypeOrmModule.forFeature([
      ClassEntity,
      ClassSessionEntity,
      HolidayEntity,
      StudentEntity,
      AttendanceEntity,
    ]),
    AttendanceModule,
  ],
  exports: [ClassesService],
})
export class ClassModule {}
