import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan } from 'typeorm';
import {
  StaffAttendanceEntity,
  AttendanceType,
} from '../entities/staff-attendance.entity';
import { StaffEntity } from '../entities/staff.entity';
import { DateTime } from 'luxon'; // Đảm bảo đã import

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'; // Định nghĩa múi giờ chuẩn

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

    // --- XÁC ĐỊNH NGÀY VÀ GIỜ HIỆN TẠI THEO GIỜ VIỆT NAM ---
    const nowLuxon = DateTime.now().setZone(VN_TIMEZONE);
    const startOfDay = nowLuxon.startOf('day').toJSDate();
    const endOfDay = nowLuxon.endOf('day').toJSDate();
    const nowForDb = nowLuxon.toJSDate(); // Lấy đối tượng Date chuẩn để lưu vào DB

    // 2. Tìm bản ghi chấm công cuối cùng trong ngày (dùng khoảng thời gian)
    const lastAttendance = await this.attendanceRepository.findOne({
        where: {
            staffId: staffId,
            // Sử dụng Date objects đã chuẩn hóa theo múi giờ VN
            timestamp: MoreThanOrEqual(startOfDay) && LessThan(endOfDay),
        },
        order: {
            timestamp: 'DESC',
        },
    });

    // 3. Xử lý logic check-in/check-out
    if (!lastAttendance || lastAttendance.type === AttendanceType.CHECK_OUT) {
      // TRƯỜNG HỢP 1: CHECK-IN
      const newCheckIn = this.attendanceRepository.create({
        staffId,
        timestamp: nowForDb, // <-- Lưu giờ VN đã chuẩn hóa
        type: AttendanceType.CHECK_IN,
      });
      await this.attendanceRepository.save(newCheckIn);
      return {
        status: 'checked_in',
        // Hiển thị giờ VN từ nowLuxon
        message: `Check-in thành công lúc ${nowLuxon.toFormat('HH:mm:ss')}`,
        timestamp: nowForDb,
        staff: { fullName: staff.fullName },
      };
    } else {
      // TRƯỜNG HỢP 2: CHECK-OUT
      if (confirm) {
        const newCheckOut = this.attendanceRepository.create({
          staffId,
          timestamp: nowForDb, // <-- Lưu giờ VN đã chuẩn hóa
          type: AttendanceType.CHECK_OUT,
        });
        await this.attendanceRepository.save(newCheckOut);
        return {
          status: 'checked_out',
           // Hiển thị giờ VN từ nowLuxon
          message: `Check-out thành công lúc ${nowLuxon.toFormat('HH:mm:ss')}`,
          timestamp: nowForDb,
          staff: { fullName: staff.fullName },
        };
      } else {
        // Lấy giờ check-in cũ và format đúng múi giờ VN
        const checkInTimeFormatted = DateTime.fromJSDate(lastAttendance.timestamp)
                                            .setZone(VN_TIMEZONE)
                                            .toFormat('HH:mm:ss');
        return {
          status: 'confirm_checkout',
          message: `Bạn đã check-in lúc ${checkInTimeFormatted}. Bạn có muốn check-out bây giờ không?`,
          checkInTime: lastAttendance.timestamp,
          staff: { fullName: staff.fullName },
        };
      }
    }
  }
}