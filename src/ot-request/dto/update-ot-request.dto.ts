import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OtRequestStatus } from '../../entities/ot-request.entity';

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
}
