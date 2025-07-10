// src/students/dto/create-student.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsIn,
  IsArray, // For validating minimum array size if classes are required
} from 'class-validator';

// DTO cho phụ huynh mới nếu tạo kèm học sinh
export class NewParentDto {
  @IsNotEmpty({ message: 'Tên phụ huynh không được để trống.' })
  @IsString({ message: 'Tên phụ huynh phải là chuỗi.' })
  fullName: string;

  @IsNotEmpty({ message: 'Số điện thoại phụ huynh không được để trống.' })
  @IsString({ message: 'Số điện thoại phụ huynh phải là chuỗi.' })
  // Regex cơ bản cho SĐT 10-11 chữ số
  // @Matches(/^\d{10,11}$/, { message: 'Số điện thoại không hợp lệ.' })
  phoneNumber: string;

  @IsOptional()
  @IsString({ message: 'Email phải là chuỗi.' })
  // @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi.' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Nghề nghiệp phải là chuỗi.' })
  job?: string;
}

export class CreateStudentDto {
  @IsNotEmpty({ message: 'Họ và Tên học sinh không được để trống.' })
  @IsString({ message: 'Họ và Tên học sinh phải là chuỗi.' })
  fullName: string;

  @IsNotEmpty({ message: 'Ngày sinh không được để trống.' })
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ.' })
  dateOfBirth: string; // Định dạng ISO Date string

  @IsNotEmpty({ message: 'Tuổi không được để trống.' })
  @IsInt({ message: 'Tuổi phải là số nguyên.' })
  age: number;

  @IsNotEmpty({ message: 'Giới tính không được để trống.' })
  @IsString({ message: 'Giới tính phải là chuỗi.' })
  @IsIn(['Nam', 'Nữ', 'Khác'], { message: 'Giới tính không hợp lệ.' })
  gender: string;

  @IsOptional()
  @IsInt({ message: 'Parent ID phải là số nguyên.', each: true }) // each: true để validate từng phần tử trong mảng
  parentId?: number; // Có thể gán parentId hiện có

  @IsOptional()
  // @ValidateNested() // Sử dụng nếu bạn muốn validate NewParentDto chi tiết hơn
  // @Type(() => NewParentDto) // Cần class-transformer cho @Type
  newParent?: NewParentDto; // Hoặc tạo phụ huynh mới

  @IsArray({ message: 'Class IDs phải là một mảng.' })
  @IsInt({ each: true, message: 'Mỗi Class ID phải là số nguyên.' })
  // @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất một lớp học.' }) // Bỏ comment nếu lớp học là bắt buộc
  classIds: number[]; // Mảng các ID lớp học
}
