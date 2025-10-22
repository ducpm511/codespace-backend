import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class PayrollReportDto {
  @IsNotEmpty()
  @IsDateString()
  fromDate: string; // 'YYYY-MM-DD'

  @IsNotEmpty()
  @IsDateString()
  toDate: string; // 'YYYY-MM-DD'

  @IsOptional()
  @IsString()
  staffId?: string; // string vì có thể nhận từ query param
}
