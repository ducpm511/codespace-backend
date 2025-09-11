// src/attendance/attendance.controller.ts
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
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { RecordQrAttendanceDto } from './dto/record-qr-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';

@Controller('attendances')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendanceService.create(createAttendanceDto);
  }

  @Post('qr-scan')
  @UsePipes(new ValidationPipe({ transform: true }))
  async recordQrAttendance(
    @Body() recordQrAttendanceDto: RecordQrAttendanceDto,
  ) {
    // Controller sẽ trả về cả bản ghi điểm danh và lịch sử
    return this.attendanceService.recordAttendanceByQr(recordQrAttendanceDto);
  }

  @Post('manual')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @HttpCode(HttpStatus.OK) // Trả về status 200 OK thay vì 201 Created
  async recordManualAttendance(
    @Body() manualAttendanceDto: ManualAttendanceDto,
  ) {
    // TODO: Thêm RoleGuard để đảm bảo chỉ Admin mới có thể gọi API này.
    return this.attendanceService.recordManualAttendance(manualAttendanceDto);
  }

  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(+id);
  }

  // Endpoint mới để lấy lịch sử điểm danh của một học sinh cho một lớp
  @Get('history/:studentId/:classId') // Hoặc chỉ studentId nếu bạn lấy lớp chính
  async getStudentAttendanceHistory(
    @Param('studentId') studentId: string,
    @Param('classId') classId: string, // Có thể bỏ nếu chỉ lấy lớp chính
  ) {
    return this.attendanceService.getAttendanceHistoryForClass(
      +studentId,
      +classId,
    );
  }

  @Get('student-class-sessions/:studentId')
  async getClassSessionsByStudent(@Param('studentId') studentId: string) {
    return this.attendanceService.getClassSessionByStudent(+studentId);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  update(
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(+id, updateAttendanceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(+id);
  }

  @Patch('session/:id')
  @UsePipes(new ValidationPipe())
  updateSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClassSessionDto,
  ) {
    return this.attendanceService.updateClassSession(id, dto);
  }
}
