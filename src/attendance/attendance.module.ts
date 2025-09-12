import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEntity } from 'src/entities/attendance.entity';
import { StudentEntity } from 'src/entities/student.entity';
import { ClassSessionEntity } from 'src/entities/class-session.entity';

@Module({
  providers: [AttendanceService],
  controllers: [AttendanceController],
  imports: [
    TypeOrmModule.forFeature([
      AttendanceEntity,
      StudentEntity,
      ClassSessionEntity,
    ]),
  ],
  exports: [AttendanceService], // Export AttendanceService if needed in other modules
})
export class AttendanceModule {}
