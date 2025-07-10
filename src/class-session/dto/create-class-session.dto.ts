// src/class-session/dto/create-class-session.dto.ts
import { IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateClassSessionDto {
  @IsNotEmpty()
  @IsDateString()
  sessionDate: Date;

  @IsNotEmpty()
  @IsString()
  startTime: string; // VD: '18:00'

  @IsNumber()
  @IsNotEmpty()
  classId: number;

  @IsNumber()
  @IsNotEmpty()
  sessionNumber: number; // Số thứ tự buổi học
}
