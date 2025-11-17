import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Raw } from 'typeorm';
import {
  OtRequestEntity,
  OtRequestStatus,
} from '../entities/ot-request.entity';
import { UpdateOtRequestDto } from './dto/update-ot-request.dto';
import { StaffEntity } from '../entities/staff.entity'; // Để lấy thông tin người duyệt
import { StaffAttendanceEntity } from '../entities/staff-attendance.entity';
import { StaffScheduleEntity } from '../entities/staff-schedule.entity';
import { DateTime } from 'luxon';

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class OtRequestsService {
  constructor(
    @InjectRepository(OtRequestEntity)
    private readonly otRequestRepo: Repository<OtRequestEntity>,
    @InjectRepository(StaffAttendanceEntity)
    private readonly attendanceRepo: Repository<StaffAttendanceEntity>,
    @InjectRepository(StaffScheduleEntity)
    private readonly scheduleRepo: Repository<StaffScheduleEntity>,
  ) {}

  async findAll(status?: OtRequestStatus): Promise<any[]> {
    // Trả về any[] vì đã "làm giàu"
    const where: FindOptionsWhere<OtRequestEntity> = {};
    if (status) {
      where.status = status;
    }

    // 1. Lấy danh sách yêu cầu OT cơ bản
    const requests = await this.otRequestRepo.find({
      where,
      relations: ['staff'],
    });

    // 2. "Làm giàu" (Enrich) từng request
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const { staffId, date } = request;

        // 2a. Lấy dữ liệu chấm công (CheckIn/CheckOut) của ngày đó
        const startOfDay = DateTime.fromISO(date, { zone: VN_TIMEZONE })
          .startOf('day')
          .toJSDate();
        const startOfNextDay = DateTime.fromISO(date, { zone: VN_TIMEZONE })
          .plus({ days: 1 })
          .startOf('day')
          .toJSDate();

        const attendances = await this.attendanceRepo.find({
          where: {
            staffId: staffId,
            timestamp: Raw(
              (alias) =>
                `${alias} >= :startOfDay AND ${alias} < :startOfNextDay`,
              { startOfDay, startOfNextDay },
            ),
          },
          order: { timestamp: 'ASC' },
        });

        // 2b. Lấy lịch trình (Ca làm/Buổi dạy) của ngày đó
        const schedules = await this.scheduleRepo.find({
          where: { staffId: staffId, date: date },
          relations: ['shift', 'classSession', 'classSession.class'],
        });

        // 2c. Trả về object đã được "làm giàu"
        return {
          ...request,
          attendances, // Mảng các lần check-in/out
          schedules, // Mảng các lịch trình
        };
      }),
    );

    return enrichedRequests;
  }

  async findOne(id: number): Promise<OtRequestEntity> {
    const request = await this.otRequestRepo.findOne({
      where: { id },
      relations: ['staff', 'approver'], // Lấy cả người duyệt nếu có
    });
    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu OT với ID ${id}`);
    }
    return request;
  }

  async updateStatus(
    id: number,
    dto: UpdateOtRequestDto,
    approverUser: StaffEntity, // Thông tin người dùng đang thực hiện (lấy từ request)
  ): Promise<OtRequestEntity> {
    const otRequest = await this.findOne(id);

    // Chỉ cho phép cập nhật nếu đang ở trạng thái pending
    if (otRequest.status !== OtRequestStatus.PENDING) {
      throw new BadRequestException(`Yêu cầu OT này đã được xử lý.`);
    }

    otRequest.status = dto.status;
    otRequest.notes = dto.notes;
    otRequest.approver = approverUser; // Gán người duyệt
    otRequest.approverId = approverUser.id;

    // Nếu duyệt, mặc định approvedDuration bằng detectedDuration
    // (Có thể thêm logic để nhận approvedDuration từ DTO nếu muốn)
    if (dto.status === OtRequestStatus.APPROVED) {
      otRequest.approvedDuration = otRequest.detectedDuration;
    } else {
      otRequest.approvedDuration = null; // Nếu từ chối thì không có giờ duyệt
    }

    return this.otRequestRepo.save(otRequest);
  }
}
