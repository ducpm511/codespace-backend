import {
  IsNumber,
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

class AssignmentDto {
  @IsNotEmpty({ message: 'ID Nhân viên không được trống.' })
  @IsNumber({}, { message: 'ID Nhân viên phải là số.' })
  staffId: number;

  @IsNotEmpty({ message: 'Key Vai trò không được trống.' })
  @IsString({ message: 'Key Vai trò phải là chuỗi.' })
  roleKey: string; // 'teacher', 'ta', etc.
}

export class BulkAssignDto {
  @IsNotEmpty({ message: 'ID Buổi học không được trống.' })
  @IsNumber({}, { message: 'ID Buổi học phải là số.' })
  classSessionId: number;

  @IsArray({ message: 'Danh sách phân công phải là mảng.' })
  @ValidateNested({ each: true, message: 'Mỗi phân công phải hợp lệ.' })
  @Type(() => AssignmentDto)
  assignments: AssignmentDto[];
}
