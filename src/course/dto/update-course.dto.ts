import { IsOptional, IsString, IsInt, IsNumber } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  numberOfSessions?: number;

  @IsOptional()
  @IsString()
  programmingLanguage?: string;

  @IsOptional()
  @IsNumber()
  tuitionFee?: number;

  @IsOptional()
  @IsString()
  discount?: string;

  @IsOptional()
  @IsString()
  description?: string;
}