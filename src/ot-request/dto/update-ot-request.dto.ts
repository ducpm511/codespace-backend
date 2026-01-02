import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { OtRequestStatus } from '../../entities/ot-request.entity';
import { Type } from 'class-transformer';

export class OtBreakdownItemDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Thời gian phải đúng định dạng HH:mm',
  })
  duration: string;

  @IsNumber()
  @Min(0)
  multiplier: number;
}

export class UpdateOtRequestDto {
  @IsEnum(OtRequestStatus)
  status: OtRequestStatus; // 'approved' hoặc 'rejected'

  @IsOptional()
  @IsString()
  notes?: string; // Ghi chú của người duyệt (tùy chọn)

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn vai trò để tính rate OT' })
  approvedRoleKey?: string; // Vai trò được duyệt để tính rate OT (tùy chọn)

  @IsOptional()
  @IsNumber()
  @Min(1)
  approvedMultiplier?: number;

  @IsOptional()
  @IsString()
  // Regex đơn giản cho định dạng giờ:phút (VD: 00:30, 01:30)
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Thời gian duyệt phải đúng định dạng HH:mm (ví dụ: 00:30)',
  })
  approvedDuration?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true }) // Báo cho NestJS biết cần validate từng phần tử bên trong
  @Type(() => OtBreakdownItemDto) // Quan trọng: Convert JSON object thành Class instance để không bị lọc bỏ
  breakdown?: OtBreakdownItemDto[];
}
