// src/modules/student-report/student-report.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentReportController } from './student-report.controller';
import { StudentReportService } from './student-report.service';
import { StudentReportEntity } from 'src/entities/student-report.entity';
import { StudentEntity } from 'src/entities/student.entity';
import { ClassEntity } from 'src/entities/class.entity';
import { CloudinaryService } from 'src/common/cloudinary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentReportEntity, StudentEntity, ClassEntity]),
  ],
  controllers: [StudentReportController],
  providers: [StudentReportService, CloudinaryService],
})
export class StudentReportModule {}
