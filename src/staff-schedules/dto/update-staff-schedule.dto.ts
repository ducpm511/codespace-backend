import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateStaffScheduleDto {
  @IsNotEmpty()
  @IsNumber()
  shiftId: number; // Chỉ cho phép cập nhật shiftId
}
