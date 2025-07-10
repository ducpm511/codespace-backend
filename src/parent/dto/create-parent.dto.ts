// src/parent/dto/create-parent.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateParentDto {
  @IsNotEmpty({ message: 'Tên phụ huynh không được để trống.' })
  @IsString({ message: 'Tên phụ huynh phải là chuỗi.' })
  fullName: string;

  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  @IsString({ message: 'Số điện thoại phải là chuỗi.' })
  // Bạn có thể thêm regex cho định dạng số điện thoại nếu cần
  phoneNumber: string;

  @IsOptional({ message: 'Địa chỉ không được để trống.' })
  @IsString({ message: 'Địa chỉ phải là chuỗi.' })
  address: string;

  @IsOptional() // <-- ĐIỀU CHỈNH: Nghề nghiệp là tùy chọn
  @IsString({ message: 'Nghề nghiệp phải là chuỗi.' })
  job?: string; // Đã đổi thành optional

  @IsOptional() // <-- THÊM DÒNG NÀY: Email là tùy chọn
  @IsEmail({}, { message: 'Email phụ huynh không hợp lệ.' })
  email?: string; // Đã thêm trường email
}
