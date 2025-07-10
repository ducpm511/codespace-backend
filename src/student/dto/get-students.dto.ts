import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetStudentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Ví dụ: giới hạn số lượng bản ghi trên mỗi trang
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string; // Tìm kiếm theo tên

  @IsOptional()
  @IsString()
  classCode?: string; // Lọc theo mã lớp

  @IsOptional()
  @IsString()
  gender?: string; // Lọc theo giới tính
}