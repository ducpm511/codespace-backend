import { IsNotEmpty, IsDateString } from 'class-validator';

export class UpdateManualAttendanceDto {
  @IsNotEmpty()
  @IsDateString(
    {},
    {
      message:
        'Timestamp phải là một chuỗi ISO 8601 hợp lệ (bao gồm ngày và giờ).',
    },
  )
  timestamp: string; // Mong đợi: '2025-11-16T10:30:00.000Z'
}
