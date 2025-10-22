import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class ScanAttendanceDto {
  @IsNotEmpty()
  @IsString()
  qrCodeData: string; // Dữ liệu từ mã QR, ví dụ: "staff_id:123"

  @IsOptional()
  @IsBoolean()
  confirm?: boolean; // Cờ xác nhận check-out, được gửi từ frontend
}
