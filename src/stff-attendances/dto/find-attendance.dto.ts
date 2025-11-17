import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class FindAttendanceDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  date: string; // Mong đợi: '2025-11-16'

  @IsNotEmpty()
  @IsString()
  staffId: string;
}
