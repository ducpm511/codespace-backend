import { IsNotEmpty, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { AttendanceType } from '../../entities/staff-attendance.entity';

export class CreateManualAttendanceDto {
  @IsNotEmpty()
  @IsNumber()
  staffId: number;

  @IsNotEmpty()
  @IsDateString(
    {},
    {
      message:
        'Timestamp phải là một chuỗi ISO 8601 hợp lệ (bao gồm ngày và giờ).',
    },
  )
  timestamp: string; // Mong đợi: '2025-11-16T10:30:00.000Z'

  @IsNotEmpty()
  @IsEnum(AttendanceType)
  type: AttendanceType;
}
