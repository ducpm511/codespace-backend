import { IsNotEmpty, IsInt, IsEnum, IsDateString } from 'class-validator';

export class CreateAttendanceDto {
  @IsNotEmpty()
  @IsInt()
  studentId: number;

  // @IsNotEmpty()
  // @IsInt()
  // classSessionId: number;

  @IsNotEmpty()
  @IsDateString() // Dùng IsDateString để nhận chuỗi ngày/giờ từ frontend rồi NestJS tự parse
  attendanceTime: Date;

  @IsNotEmpty()
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status: 'present' | 'absent' | 'late' | 'excused';
}
