// create-role.dto.ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';
export class CreateRoleDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Key chỉ chứa chữ thường, số và dấu gạch ngang.',
  })
  key: string;
}
