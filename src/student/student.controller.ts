// src/students/students.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { StudentsService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentEntity } from '../entities/student.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { CreateStudentWithParentDto } from './dto/create-student-with-parent.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @Body() createStudentDto: CreateStudentDto,
  ): Promise<StudentEntity> {
    // Corrected: Directly call the 'create' method, which now handles parent creation/assignment internally.
    return await this.studentsService.create(createStudentDto);
  }

  @Post('create-with-parent')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createWithParent(
    @Body() createStudentWithParentDto: CreateStudentWithParentDto,
  ): Promise<StudentEntity> {
    return await this.studentsService.createWithParent(
      createStudentWithParentDto,
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  async findAll(): Promise<StudentEntity[]> {
    return await this.studentsService.findAll();
  }

  @Get('birthdays-this-week')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  async getBirthdaysThisWeek(): Promise<string> {
    console.log('Received request for birthdays this week');
    const studentHasBirthdayThisWeek =
      await this.studentsService.getBirthdaysInWeek();
    const discordMessage = studentHasBirthdayThisWeek
      .map((student) => {
        const classNames = student.classes.join(', ');
        const dob = student.dateOfBirth; // Định dạng ngày sinh
        return `- ${student.fullName} (Ngày sinh: ${dob}, Lớp: ${classNames})`;
      })
      .join('\n');

    if (discordMessage.length > 0) {
      console.log('Students with birthdays this week:\n' + discordMessage);
    } else {
      console.log('No students have birthdays this week.');
    }
    return discordMessage || 'No students have birthdays this week.';
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<StudentEntity> {
    return await this.studentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudentDto: UpdateStudentDto,
  ): Promise<StudentEntity> {
    return await this.studentsService.update(id, updateStudentDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.studentsService.remove(id);
  }
}
