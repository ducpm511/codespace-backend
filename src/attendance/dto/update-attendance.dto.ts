import { IsOptional, IsInt, IsEnum, IsDateString } from 'class-validator';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsInt()
  studentId?: number;

  // @IsOptional()
  // @IsInt()
  // classSessionId?: number;

  @IsOptional()
  @IsDateString() // Dùng IsDateString để nhận chuỗi ngày/giờ từ frontend rồi NestJS tự parse
  attendanceTime: Date;

  @IsOptional()
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status?: 'present' | 'absent' | 'late' | 'excused';
}
