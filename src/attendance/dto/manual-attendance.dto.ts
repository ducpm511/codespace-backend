import { IsArray, ArrayNotEmpty, IsNumber, IsNotEmpty } from 'class-validator';

export class ManualAttendanceDto {
  @IsNotEmpty({ message: 'ID học sinh không được để trống.' })
  @IsNumber({}, { message: 'ID học sinh phải là một số.' })
  studentId: number;

  @IsArray({ message: 'Danh sách ID buổi học phải là một mảng.' })
  @ArrayNotEmpty({ message: 'Danh sách ID buổi học không được để trống.' })
  @IsNumber(
    {},
    {
      each: true,
      message: 'Mỗi ID trong danh sách buổi học phải là một số.',
    },
  )
  sessionIds: number[];
}
