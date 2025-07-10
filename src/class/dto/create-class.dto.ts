import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
} from 'class-validator';

export class CreateClassDto {
  @IsNotEmpty({ message: 'Tên lớp học không được để trống.' })
  @IsString({ message: 'Tên lớp học phải là chuỗi.' })
  className: string;

  @IsNotEmpty({ message: 'Mã lớp học không được để trống.' })
  @IsString({ message: 'Mã lớp học phải là chuỗi.' })
  classCode: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ.' })
  startDate?: string; // ISO 8601 string

  @IsOptional()
  @IsInt({ message: 'Tổng số buổi học phải là số nguyên.' })
  totalSessions?: number;

  @IsOptional()
  @IsArray({ message: 'Ngày lịch học phải là một mảng.' })
  @IsString({ each: true, message: 'Mỗi ngày trong lịch học phải là chuỗi.' })
  scheduleDays?: string[]; // Ví dụ: ['Monday', 'Friday']

  @IsOptional()
  @IsString({
    message:
      'Thời gian lịch học phải là chuỗi thời gian hợp lệ (ví dụ: HH:MM:SS).',
  })
  scheduleTime?: string; // Ví dụ: '18:00:00'

  @IsOptional()
  @IsString({ message: 'Năm học phải là chuỗi.' })
  academicYear?: string;
}
