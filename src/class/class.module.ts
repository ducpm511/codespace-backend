import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from 'src/entities/class.entity';
import { AttendanceModule } from '../attendance/attendance.module'; // <-- Import AttendanceModule

@Module({
  providers: [ClassesService],
  controllers: [ClassesController],
  imports: [
    TypeOrmModule.forFeature([ClassEntity]),
    AttendanceModule, // <-- Thêm AttendanceModule
  ],
  exports: [ClassesService], // Thêm exports nếu các module khác cần sử dụng ClassesService
})
export class ClassModule {}
