import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Get,
  Patch,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { StaffAttendanceService } from './staff-attendance.service';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';
import { CreateManualAttendanceDto } from './dto/create-manual-attendance.dto';
import { UpdateManualAttendanceDto } from './dto/update-manual-attendance.dto';
import { FindAttendanceDto } from './dto/find-attendance.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';

@Controller('staff-attendances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN) // Thêm các guard cần thiết ở đây
export class StaffAttendanceController {
  constructor(
    private readonly staffAttendanceService: StaffAttendanceService,
  ) {}

  @Post('scan')
  scan(@Body() scanAttendanceDto: ScanAttendanceDto) {
    return this.staffAttendanceService.scan(scanAttendanceDto);
  }

  /**
   * Lấy danh sách chấm công của nhân viên theo ngày
   * API: GET /staff-attendances/manual?staffId=1&date=2025-10-31
   */
  @Get('manual')
  // @UseGuards(...) // Nên bảo vệ endpoint này, chỉ cho admin/manager
  getForStaffByDate(@Query() query: FindAttendanceDto) {
    return this.staffAttendanceService.getForStaffByDate(
      parseInt(query.staffId),
      query.date,
    );
  }

  /**
   * Admin tạo một bản ghi chấm công mới
   * API: POST /staff-attendances/manual
   */
  @Post('manual')
  // @UseGuards(...)
  createManual(@Body() dto: CreateManualAttendanceDto) {
    return this.staffAttendanceService.createManual(dto);
  }

  /**
   * Admin sửa thời gian của một bản ghi
   * API: PATCH /staff-attendances/manual/:id
   */
  @Patch('manual/:id')
  // @UseGuards(...)
  updateManual(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateManualAttendanceDto,
  ) {
    return this.staffAttendanceService.updateManual(id, dto);
  }

  /**
   * Admin xóa một bản ghi chấm công
   * API: DELETE /staff-attendances/manual/:id
   */
  @Delete('manual/:id')
  // @UseGuards(...)
  @HttpCode(HttpStatus.NO_CONTENT) // Trả về 204 khi xóa thành công
  deleteManual(@Param('id', ParseIntPipe) id: number) {
    return this.staffAttendanceService.deleteManual(id);
  }
}
