import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsObject, // <-- THÊM MỚI
  IsOptional,
  IsDate, // <-- THÊM MỚI
} from 'class-validator';
import { Type } from 'class-transformer'; // <-- THÊM MỚI

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  // --- THAY ĐỔI ---
  @Type(() => Date) // 1. Chuyển đổi chuỗi thành đối tượng Date
  @IsDate() // 2. Xác thực xem nó có phải là đối tượng Date hợp lệ không
  @IsNotEmpty()
  dateOfBirth: Date;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  identityCardNumber: string;

  @IsNotEmpty()
  @IsString()
  emergencyContactNumber: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  // --- THÊM MỚI ---
  @IsOptional() // `rates` là không bắt buộc (dành cho nhân viên full-time)
  @IsObject() // Yêu cầu `rates` phải là một object
  rates?: Record<string, number>;
}
