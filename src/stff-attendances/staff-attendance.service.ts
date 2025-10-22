import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan } from 'typeorm'; // THÊM IMPORT MỚI
import {
  StaffAttendanceEntity,
  AttendanceType,
} from '../entities/staff-attendance.entity';
import { StaffEntity } from '../entities/staff.entity';
import { DateTime } from 'luxon'; // THÊM IMPORT MỚI

@Injectable()
export class StaffAttendanceService {
  constructor(
    @InjectRepository(StaffAttendanceEntity)
    private readonly attendanceRepository: Repository<StaffAttendanceEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepository: Repository<StaffEntity>,
  ) {}

  async scan({
    qrCodeData,
    confirm = false,
  }: {
    qrCodeData: string;
    confirm?: boolean;
  }) {
    // 1. Phân tích staffId (không đổi)
    const staffIdMatch = qrCodeData.match(/^staff_id:(\d+)$/);
    if (!staffIdMatch || !staffIdMatch[1]) {
      throw new BadRequestException('Mã QR không hợp lệ...');
    }
    const staffId = parseInt(staffIdMatch[1], 10);
    const staff = await this.staffRepository.findOneBy({ id: staffId });
    if (!staff) {
      throw new NotFoundException(`Không tìm thấy nhân viên...`);
    }

    // --- THAY ĐỔI: Sử dụng Luxon để xác định khoảng thời gian ---
    const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
    const nowLuxon = DateTime.now().setZone(VN_TIMEZONE);
    const startOfDay = nowLuxon.startOf('day').toJSDate(); // Bắt đầu ngày hôm nay (00:00:00 giờ VN)
    const endOfDay = nowLuxon.endOf('day').toJSDate(); // Kết thúc ngày hôm nay (23:59:59 giờ VN)

    // 2. Tìm bản ghi chấm công cuối cùng trong ngày (dùng khoảng thời gian)
    const lastAttendance = await this.attendanceRepository.findOne({
      where: {
        staffId: staffId,
        timestamp: MoreThanOrEqual(startOfDay) && LessThan(endOfDay), // Tìm trong khoảng startOfDay <= timestamp < endOfDay+1ms (tương đương <= endOfDay)
      },
      order: {
        timestamp: 'DESC', // Lấy bản ghi gần nhất
      },
    });

    const now = new Date(); // Vẫn dùng new Date() để lưu vào DB

    // 3. Xử lý logic check-in/check-out (KHÔNG ĐỔI)
    if (!lastAttendance || lastAttendance.type === AttendanceType.CHECK_OUT) {
      // TRƯỜNG HỢP 1: CHECK-IN
      const newCheckIn = this.attendanceRepository.create({
        staffId,
        timestamp: now,
        type: AttendanceType.CHECK_IN,
      });
      await this.attendanceRepository.save(newCheckIn);
      return {
        status: 'checked_in',
        message: `Check-in thành công lúc ${now.toLocaleTimeString('vi-VN', { timeZone: VN_TIMEZONE })}`, // Thêm timeZone
        timestamp: now,
        staff: { fullName: staff.fullName },
      };
    } else {
      // TRƯỜNG HỢP 2: CHECK-OUT
      if (confirm) {
        const newCheckOut = this.attendanceRepository.create({
          staffId,
          timestamp: now,
          type: AttendanceType.CHECK_OUT,
        });
        await this.attendanceRepository.save(newCheckOut);
        return {
          status: 'checked_out',
          message: `Check-out thành công lúc ${now.toLocaleTimeString('vi-VN', { timeZone: VN_TIMEZONE })}`, // Thêm timeZone
          timestamp: now,
          staff: { fullName: staff.fullName },
        };
      } else {
        return {
          status: 'confirm_checkout',
          message: `Bạn đã check-in lúc ${lastAttendance.timestamp.toLocaleTimeString('vi-VN', { timeZone: VN_TIMEZONE })}. Bạn có muốn check-out bây giờ không?`, // Thêm timeZone
          checkInTime: lastAttendance.timestamp,
          staff: { fullName: staff.fullName },
        };
      }
    }
  }
}
