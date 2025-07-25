// src/attendance/dto/update-class-session.dto.ts
import { IsInt, IsOptional, Matches } from 'class-validator';

export class UpdateClassSessionDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'sessionDate must be in YYYY-MM-DD format',
  })
  sessionDate?: string;

  @IsOptional()
  @IsInt()
  sessionNumber?: number;
}
