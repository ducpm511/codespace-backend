import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from 'src/entities/class.entity';
import { AttendanceModule } from '../attendance/attendance.module'; // <-- Import AttendanceModule
import { ClassSessionEntity } from 'src/entities/class-session.entity';

@Module({
  providers: [ClassesService],
  controllers: [ClassesController],
  imports: [
    TypeOrmModule.forFeature([ClassEntity, ClassSessionEntity]),
    AttendanceModule,
  ],
  exports: [ClassesService],
})
export class ClassModule {}
