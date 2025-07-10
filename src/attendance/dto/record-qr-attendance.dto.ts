// src/attendance/dto/record-qr-attendance.dto.ts
import {
  IsNotEmpty,
  IsString,
  //   IsOptional,
  //   IsDateString,
} from 'class-validator';

export class RecordQrAttendanceDto {
  @IsNotEmpty()
  @IsString()
  qrCodeData: string; // Chuỗi từ QR code, ví dụ: "student_id:123"

  // Có thể thêm trường này nếu muốn cho phép frontend gửi thời gian điểm danh cụ thể
  // @IsOptional()
  // @IsDateString()
  // attendanceTime?: string;
}
