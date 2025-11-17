import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan, Raw } from 'typeorm';
import {
  StaffAttendanceEntity,
  AttendanceType,
} from '../entities/staff-attendance.entity';
import { StaffEntity } from '../entities/staff.entity';
import { DateTime } from 'luxon'; // Đảm bảo đã import
import { CreateManualAttendanceDto } from './dto/create-manual-attendance.dto';
import { UpdateManualAttendanceDto } from './dto/update-manual-attendance.dto';

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
        const checkInTimeFormatted = DateTime.fromJSDate(
          lastAttendance.timestamp,
        )
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

  async getForStaffByDate(
    staffId: number,
    date: string,
  ): Promise<StaffAttendanceEntity[]> {
    // 1. Xác định thời điểm bắt đầu ngày (00:00:00)
    const startOfDay = DateTime.fromISO(date, { zone: VN_TIMEZONE })
      .startOf('day')
      .toJSDate();

    // 2. Xác định thời điểm bắt đầu ngày KẾ TIẾP (00:00:00 của ngày mai)
    const startOfNextDay = DateTime.fromISO(date, { zone: VN_TIMEZONE })
      .plus({ days: 1 })
      .startOf('day')
      .toJSDate();

    // 3. --- SỬA LỖI TRUY VẤN TẠI ĐÂY ---
    // Sử dụng Raw để tạo điều kiện AND cho cùng một cột
    return this.attendanceRepository.find({
      where: {
        staffId: staffId,
        timestamp: Raw(
          (alias) => `${alias} >= :startOfDay AND ${alias} < :startOfNextDay`,
          { startOfDay, startOfNextDay },
        ),
      },
      order: {
        timestamp: 'ASC', // Sắp xếp từ sớm đến muộn
      },
    });
  }

  async createManual(
    dto: CreateManualAttendanceDto,
  ): Promise<StaffAttendanceEntity> {
    const staff = await this.staffRepository.findOneBy({ id: dto.staffId });
    if (!staff) {
      throw new NotFoundException(
        `Không tìm thấy nhân viên với ID: ${dto.staffId}`,
      );
    }

    const newAttendance = this.attendanceRepository.create({
      staffId: dto.staffId,
      timestamp: new Date(dto.timestamp), // Chuyển chuỗi ISO thành Date object
      type: dto.type,
    });
    return this.attendanceRepository.save(newAttendance);
  }

  async updateManual(
    id: number,
    dto: UpdateManualAttendanceDto,
  ): Promise<StaffAttendanceEntity> {
    const attendanceRecord = await this.attendanceRepository.findOneBy({ id });
    if (!attendanceRecord) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi chấm công với ID: ${id}`,
      );
    }

    attendanceRecord.timestamp = new Date(dto.timestamp); // Cập nhật giờ mới
    return this.attendanceRepository.save(attendanceRecord);
  }

  async deleteManual(id: number): Promise<void> {
    const result = await this.attendanceRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi chấm công với ID: ${id}`,
      );
    }
  }
}
