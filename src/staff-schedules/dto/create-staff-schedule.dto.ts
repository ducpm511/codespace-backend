import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class CreateStaffScheduleDto {
  @IsNotEmpty()
  @IsNumber()
  staffId: number;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsNumber()
  @ValidateIf((o) => !o.classSessionId) // Bắt buộc nếu classSessionId không có
  shiftId?: number;

  @IsOptional()
  @IsNumber()
  @ValidateIf((o) => !o.shiftId) // Bắt buộc nếu shiftId không có
  classSessionId?: number;
}
