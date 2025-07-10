// src/students/dto/update-student.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsString,
  IsInt,
  IsDateString,
  IsIn,
  IsArray,
} from 'class-validator';
import { CreateStudentDto, NewParentDto } from './create-student.dto'; // Import cả NewParentDto

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @IsOptional()
  @IsString({ message: 'Họ và Tên học sinh phải là chuỗi.' })
  fullName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ.' })
  dateOfBirth?: string;

  @IsOptional()
  @IsInt({ message: 'Tuổi phải là số nguyên.' })
  age?: number;

  @IsOptional()
  @IsString({ message: 'Giới tính phải là chuỗi.' })
  @IsIn(['Nam', 'Nữ', 'Khác'], { message: 'Giới tính không hợp lệ.' })
  gender?: string;

  @IsOptional()
  @IsInt({ message: 'Parent ID phải là số nguyên.', each: true })
  parentId?: number | null; // Có thể là null để bỏ gán phụ huynh

  @IsOptional()
  newParent?: NewParentDto; // Không cho phép tạo phụ huynh mới khi update

  @IsOptional()
  @IsArray({ message: 'Class IDs phải là một mảng.' })
  @IsInt({ each: true, message: 'Mỗi Class ID phải là số nguyên.' })
  classIds?: number[];
}
