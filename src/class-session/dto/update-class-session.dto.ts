// src/class-session/dto/update-class-session.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateClassSessionDto } from './create-class-session.dto';

export class UpdateClassSessionDto extends PartialType(CreateClassSessionDto) {}
