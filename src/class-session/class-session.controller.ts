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
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClassSessionService } from './class-session.service';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';

@Controller('class-sessions')
@UseGuards(JwtAuthGuard, RolesGuard) // Bảo vệ tất cả các route bằng JwtAuthGuard
export class ClassSessionController {
  constructor(private readonly classSessionService: ClassSessionService) {}

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createClassSessionDto: CreateClassSessionDto) {
    return this.classSessionService.create(createClassSessionDto);
  }

  @Get()
  findAll() {
    return this.classSessionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classSessionService.findOne(+id);
  }

  // @Get('student/:studentId')
  // getSessionsByStudentId(@Param('studentId') studentId: string) {
  //   return this.classSessionService.getSessionsByStudentId(+studentId);
  // }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  update(
    @Param('id') id: string,
    @Body() updateClassSessionDto: UpdateClassSessionDto,
  ) {
    return this.classSessionService.update(+id, updateClassSessionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.classSessionService.remove(+id);
  }

  @Get('schedule/:classId')
  async getScheduleFromSession(@Param('classId') classId: string) {
    return await this.classSessionService.getScheduleFromSession(+classId);
  }
}
