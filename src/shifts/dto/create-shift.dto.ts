import {
  IsNotEmpty,
  IsString,
  Matches,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

export class CreateShiftDto {
  @IsNotEmpty({ message: 'Tên ca không được để trống.' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Giờ bắt đầu không được để trống.' })
  @Matches(timeRegex, { message: 'Giờ bắt đầu phải có định dạng HH:mm:ss.' })
  startTime: string;

  @IsNotEmpty({ message: 'Giờ kết thúc không được để trống.' })
  @Matches(timeRegex, { message: 'Giờ kết thúc phải có định dạng HH:mm:ss.' })
  endTime: string;

  @IsOptional()
  @Matches(timeRegex, { message: 'Thời gian nghỉ phải có định dạng HH:mm:ss.' })
  breakDuration?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Hệ số OT phải là một số.' })
  @Min(1, { message: 'Hệ số OT phải lớn hơn hoặc bằng 1.' })
  otMultiplier?: number;
}
