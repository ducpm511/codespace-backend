import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParentService } from './parent.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { StudentEntity } from '../entities/student.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard'; // Import JwtAuthGuard

@Controller('parents')
@UseGuards(JwtAuthGuard) // Protect all routes with JwtAuthGuard
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createParentDto: CreateParentDto) {
    return this.parentService.create(createParentDto);
  }

  @Get()
  findAll() {
    return this.parentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parentService.findOne(+id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  update(@Param('id') id: string, @Body() updateParentDto: UpdateParentDto) {
    return this.parentService.update(+id, updateParentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.parentService.remove(+id);
  }

  @Get(':id/students')
  findStudents(@Param('id') id: string): Promise<StudentEntity[]> {
    return this.parentService.findStudents(+id);
  }
}
