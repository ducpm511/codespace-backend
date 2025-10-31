import {
  Controller,
  Get,
  Post,
  Body,
  ParseIntPipe,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffSchedulesService } from './staff-schedules.service';
import { CreateStaffScheduleDto } from './dto/create-staff-schedule.dto';
import { BulkAssignDto } from './dto/bulk-assign.dto';
import { UpdateStaffScheduleDto } from './dto/update-staff-schedule.dto';

@Controller('staff-schedules')
export class StaffSchedulesController {
  constructor(private readonly staffSchedulesService: StaffSchedulesService) {}

  @Post()
  create(@Body() createDto: CreateStaffScheduleDto) {
    return this.staffSchedulesService.create(createDto);
  }

  @Get()
  findAll() {
    return this.staffSchedulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.staffSchedulesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffScheduleDto,
  ) {
    return this.staffSchedulesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    // Sửa kiểu trả về thành Promise<void> cho rõ ràng
    return this.staffSchedulesService.remove(id);
  }

  @Post('assign-shift-range')
  assignShiftRange(
    @Body()
    dto: {
      staffId: number;
      shiftId: number;
      fromDate: string;
      toDate: string;
      daysOfWeek: number[];
    },
  ) {
    return this.staffSchedulesService.assignShiftRange(dto);
  }

  @Post('bulk-assign-session')
  bulkAssignSession(@Body() dto: BulkAssignDto) {
    return this.staffSchedulesService.bulkAssignSession(dto);
  }

  @Get('staff/:staffId/today-teaching')
  async findTodayTeachingSchedulesForStaff(
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    const schedules =
      this.staffSchedulesService.findTodayTeachingSchedules(staffId);
    const discordMessage = (await schedules)
      .map((schedule) => {
        const classSession = schedule.classSession;
        if (!classSession) {
          return ``;
        }
        return `- ${classSession.class.className} (${classSession.class.classCode}) lúc ${classSession.startTime}`;
      })
      .join('\n');

    if (discordMessage.length > 0) {
      return `Lịch dạy hôm nay của bạn:\n` + discordMessage;
    } else {
      return `Bạn không có lịch dạy/trợ giảng ngày hôm nay`;
    }
  }
}
