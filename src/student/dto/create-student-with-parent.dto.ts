// src/students/dto/create-student-with-parent.dto.ts
import {
  IsString,
  IsInt,
  IsOptional,
  ValidateNested,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO cơ bản cho việc tạo Phụ huynh mới
export class CreateNewParentDto {
  @IsNotEmpty({ message: 'Tên phụ huynh không được để trống.' })
  @IsString({ message: 'Tên phụ huynh phải là chuỗi.' })
  fullName: string;

  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  @IsString({ message: 'Số điện thoại phải là chuỗi.' })
  // Bạn có thể thêm regex cho định dạng số điện thoại
  phoneNumber: string;

  @IsOptional() // Email có thể tùy chọn nếu không muốn bắt buộc
  @IsEmail({}, { message: 'Email phụ huynh không hợp lệ.' })
  email?: string;

  @IsOptional({ message: 'Địa chỉ không được để trống.' })
  @IsString({ message: 'Địa chỉ phải là chuỗi.' })
  address: string;
}

// DTO cho việc tạo Học sinh, có thể kèm theo Phụ huynh mới hoặc ID Phụ huynh hiện có
export class CreateStudentWithParentDto {
  @IsNotEmpty({ message: 'Tên học sinh không được để trống.' })
  @IsString({ message: 'Tên học sinh phải là chuỗi.' })
  fullName: string;

  @IsDateString({}, { message: 'Ngày sinh không hợp lệ.' })
  dateOfBirth: string; // ISO 8601 string

  @IsInt({ message: 'Tuổi phải là số nguyên.' })
  age: number;

  @IsNotEmpty({ message: 'Giới tính không được để trống.' })
  @IsString({ message: 'Giới tính phải là chuỗi.' })
  gender: string;

  @IsArray({ message: 'Class IDs phải là một mảng.' })
  @IsInt({ each: true, message: 'Mỗi Class ID phải là số nguyên.' })
  // @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất một lớp học.' }) // Bỏ comment nếu lớp học là bắt buộc
  classIds: number[]; // Mảng các ID lớp học

  @IsOptional()
  @IsInt({ message: 'ID phụ huynh phải là số nguyên.' })
  parentId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNewParentDto)
  newParent?: CreateNewParentDto;
}
