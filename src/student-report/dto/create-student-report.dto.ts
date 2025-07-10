// src/modules/student-report/dto/create-student-report.dto.ts
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

class PdfFileDto {
  @IsUrl()
  fileUrl: string;

  @IsIn(['midterm', 'final'])
  testType: 'midterm' | 'final';

  @IsNumber()
  score: number;
}

class ScratchEmbedDto {
  @IsString()
  @IsNotEmpty()
  embedCode: string;

  @IsString()
  @IsNotEmpty()
  projectName: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateStudentReportDto {
  @IsNumber()
  studentId: number;

  @IsNumber()
  classId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PdfFileDto)
  @IsOptional()
  pdfFiles?: PdfFileDto[];

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  youtubeLinks?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScratchEmbedDto)
  @IsOptional()
  scratchProjects?: ScratchEmbedDto[];
}
