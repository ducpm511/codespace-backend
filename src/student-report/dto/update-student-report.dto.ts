// src/modules/student-report/dto/update-student-report.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateStudentReportDto } from './create-student-report.dto';

export class UpdateStudentReportDto extends PartialType(
  CreateStudentReportDto,
) {}
