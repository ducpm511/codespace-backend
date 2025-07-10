import { IsNotEmpty, IsString, IsDate, IsEmail } from 'class-validator';

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsDate()
  dateOfBirth: Date;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  identityCardNumber: string;

  @IsNotEmpty()
  @IsString()
  emergencyContactNumber: string;

  @IsNotEmpty()
  @IsString()
  title: string;
}