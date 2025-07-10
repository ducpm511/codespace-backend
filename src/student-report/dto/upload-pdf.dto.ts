import { IsNotEmpty, IsNumberString } from 'class-validator';

export class UploadPdfDto {
  @IsNotEmpty()
  @IsNumberString()
  studentId: string;

  @IsNotEmpty()
  @IsNumberString()
  classId: string;
}
