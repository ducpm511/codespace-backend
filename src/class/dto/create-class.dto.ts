import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
} from 'class-validator';

export class ClassScheduleItem {
  @IsString({ message: 'Ngày trong lịch học phải là chuỗi.' })
  @IsNotEmpty({ message: 'Ngày trong lịch học không được để trống.' })
  day: string; // Ví dụ: 'Monday', 'Tuesday', ...

  @IsString({ message: 'Thời gian trong lịch học phải là chuỗi.' })
  @IsNotEmpty({ message: 'Thời gian trong lịch học không được để trống.' })
  time: string; // Ví dụ: '14:00:00' (24-hour format)
}
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
  @IsArray({ message: 'Lịch học phải là một mảng.' })
  @IsNotEmpty({
    each: true,
    message: 'Mỗi phần tử trong lịch học phải có dữ liệu.',
  })
  @Type(() => ClassScheduleItem)
  schedule?: ClassScheduleItem[];

  @IsOptional()
  @IsString({ message: 'Năm học phải là chuỗi.' })
  academicYear?: string;
}
