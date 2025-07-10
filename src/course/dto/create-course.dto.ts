import { IsNotEmpty, IsString, IsInt, IsNumber, IsOptional } from 'class-validator';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsInt()
  numberOfSessions: number;

  @IsNotEmpty()
  @IsString()
  programmingLanguage: string;

  @IsNotEmpty()
  @IsNumber()
  tuitionFee: number;

  @IsOptional()
  @IsString()
  discount?: string;

  @IsOptional()
  @IsString()
  description?: string;
}