import { Controller, Post, Body } from '@nestjs/common';
import { StaffAttendanceService } from './staff-attendance.service';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';

@Controller('staff-attendances')
export class StaffAttendanceController {
  constructor(
    private readonly staffAttendanceService: StaffAttendanceService,
  ) {}

  @Post('scan')
  scan(@Body() scanAttendanceDto: ScanAttendanceDto) {
    return this.staffAttendanceService.scan(scanAttendanceDto);
  }
}
