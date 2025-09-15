// src/class-session/dto/create-class-session.dto.ts
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsNumber, Matches } from 'class-validator';

export class CreateClassSessionDto {
  @Type(() => Date)
  @IsNotEmpty()
  @IsDate()
  sessionDate: Date;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/, {
    // Regex cho HH:mm hoặc HH:mm:ss
    message: 'startTime phải có định dạng HH:mm hoặc HH:mm:ss.',
  })
  startTime: string; // VD: '18:00'

  @IsNumber()
  @IsNotEmpty()
  classId: number;

  @IsNumber()
  @IsNotEmpty()
  sessionNumber: number; // Số thứ tự buổi học
}
