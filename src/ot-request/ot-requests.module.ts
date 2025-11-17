import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtRequestEntity } from '../entities/ot-request.entity';
import { StaffEntity } from '../entities/staff.entity'; // Cần để lấy thông tin người duyệt
import { OtRequestsService } from './ot-requests.service';
import { OtRequestsController } from './ot-requests.controller';
import { StaffAttendanceEntity } from 'src/entities/staff-attendance.entity';
import { StaffScheduleEntity } from 'src/entities/staff-schedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OtRequestEntity,
      StaffEntity,
      StaffAttendanceEntity,
      StaffScheduleEntity,
    ]),
  ],
  controllers: [OtRequestsController],
  providers: [OtRequestsService],
})
export class OtRequestsModule {}
