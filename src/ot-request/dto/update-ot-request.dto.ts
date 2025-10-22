import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OtRequestStatus } from '../../entities/ot-request.entity';

export class UpdateOtRequestDto {
  @IsEnum(OtRequestStatus)
  status: OtRequestStatus; // 'approved' hoặc 'rejected'

  @IsOptional()
  @IsString()
  notes?: string; // Ghi chú của người duyệt (tùy chọn)
}
