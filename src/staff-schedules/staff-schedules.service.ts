import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not } from 'typeorm';
import { StaffScheduleEntity } from '../entities/staff-schedule.entity';
import { CreateStaffScheduleDto } from './dto/create-staff-schedule.dto';
import { DateTime, Interval } from 'luxon';
import { BulkAssignDto } from './dto/bulk-assign.dto';
import { ClassSessionEntity } from 'src/entities/class-session.entity';
import { UpdateStaffScheduleDto } from './dto/update-staff-schedule.dto';
import { ShiftEntity } from 'src/entities/shift.entity';

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
@Injectable()
export class StaffSchedulesService {
  constructor(
    @InjectRepository(StaffScheduleEntity)
    private readonly scheduleRepository: Repository<StaffScheduleEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly sessionRepository: Repository<ClassSessionEntity>,
    @InjectRepository(ShiftEntity)
    private readonly shiftRepository: Repository<ShiftEntity>,
  ) {}

  async create(dto: CreateStaffScheduleDto): Promise<StaffScheduleEntity> {
    const newSchedule = this.scheduleRepository.create(dto);
    return this.scheduleRepository.save(newSchedule);
  }

  async findAll(): Promise<StaffScheduleEntity[]> {
    // Tải kèm thông tin của staff, shift, classSession và class để hiển thị trên lịch
    return this.scheduleRepository.find({
      relations: ['staff', 'shift', 'classSession', 'classSession.class'],
    });
  }

  async findOne(id: number): Promise<StaffScheduleEntity> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['staff', 'shift'], // Load relations needed for display/update
    });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch phân công với ID ${id}`);
    }
    return schedule;
  }

  async update(
    id: number,
    dto: UpdateStaffScheduleDto,
  ): Promise<StaffScheduleEntity> {
    const schedule = await this.findOne(id);
    // Chỉ cho phép cập nhật shiftId cho lịch gán ca (không phải lịch dạy)
    if (!schedule.shiftId) {
      throw new BadRequestException(
        'Chỉ có thể cập nhật ca làm việc cho lịch gán theo ca.',
      );
    }
    // TODO: Add validation if needed (e.g., check if the new shiftId exists)
    this.scheduleRepository.merge(schedule, { shiftId: dto.shiftId }); // Chỉ cập nhật shiftId
    return this.scheduleRepository.save(schedule);
  }

  async remove(id: number): Promise<void> {
    const result = await this.scheduleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy lịch phân công với ID ${id}`);
    }
  }

  async assignShiftRange(dto: {
    staffId: number;
    shiftId: number;
    fromDate: string;
    toDate: string;
    daysOfWeek: number[];
  }): Promise<{ created: StaffScheduleEntity[]; skipped: string[] }> {
    const { staffId, shiftId, fromDate, toDate, daysOfWeek } = dto;

    // 1. Lấy thông tin của ca làm việc mới để biết giờ
    const newShift = await this.shiftRepository.findOneBy({ id: shiftId });
    if (!newShift) {
      throw new NotFoundException(
        `Không tìm thấy ca làm việc với ID ${shiftId}`,
      );
    }

    // 2. Lấy tất cả lịch trình hiện có của nhân viên trong khoảng thời gian
    const existingSchedules = await this.scheduleRepository.find({
      where: {
        staffId: staffId,
        date: Between(fromDate, toDate),
      },
      relations: ['shift', 'classSession'], // Lấy đủ thông tin để tính giờ
    });

    const schedulesToCreate: Partial<StaffScheduleEntity>[] = [];
    const skippedDates: string[] = []; // Lưu các ngày bị bỏ qua do trùng lịch

    let currentDate = DateTime.fromISO(fromDate);
    const endDate = DateTime.fromISO(toDate);

    // 3. Lặp qua các ngày để tạo lịch mới
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISODate();
      const isoWeekday = currentDate.weekday;
      const jsWeekday = isoWeekday % 7;

      if (daysOfWeek.includes(jsWeekday)) {
        // Tạo khoảng thời gian của ca làm việc MỚI
        const newShiftStart = DateTime.fromISO(
          `${dateStr}T${newShift.startTime}`,
          { zone: VN_TIMEZONE },
        );
        const newShiftEnd = DateTime.fromISO(`${dateStr}T${newShift.endTime}`, {
          zone: VN_TIMEZONE,
        });
        const newShiftInterval = Interval.fromDateTimes(
          newShiftStart,
          newShiftEnd,
        );

        // Kiểm tra xem ca mới này có trùng giờ với lịch nào đã có vào ngày này không
        const isOverlapping = existingSchedules.some((existing) => {
          if (existing.date !== dateStr) return false; // Chỉ xét ngày hiện tại

          let existingInterval: Interval | null = null;
          if (existing.classSession) {
            // Áp dụng rule 120 phút cho buổi dạy
            const start = DateTime.fromISO(
              `${existing.date}T${existing.classSession.startTime}`,
              { zone: VN_TIMEZONE },
            );
            existingInterval = Interval.fromDateTimes(
              start.minus({ minutes: 15 }),
              start.plus({ minutes: 105 }),
            ); // 90 + 15
          } else if (existing.shift) {
            const start = DateTime.fromISO(
              `${existing.date}T${existing.shift.startTime}`,
              { zone: VN_TIMEZONE },
            );
            const end = DateTime.fromISO(
              `${existing.date}T${existing.shift.endTime}`,
              { zone: VN_TIMEZONE },
            );
            existingInterval = Interval.fromDateTimes(start, end);
          }

          return existingInterval
            ? newShiftInterval.overlaps(existingInterval)
            : false;
        });

        if (isOverlapping) {
          skippedDates.push(dateStr);
        } else {
          schedulesToCreate.push({
            staffId,
            shiftId,
            date: dateStr,
            roleKey: 'part-time',
          }); // Gán roleKey 'part-time'
        }
      }
      currentDate = currentDate.plus({ days: 1 });
    }

    // 4. Lưu các lịch hợp lệ
    if (schedulesToCreate.length > 0) {
      const created = await this.scheduleRepository.save(schedulesToCreate);
      return { created, skipped: skippedDates };
    } else {
      return { created: [], skipped: skippedDates };
    }
  }
  async bulkAssignSession(dto: BulkAssignDto): Promise<StaffScheduleEntity[]> {
    const { classSessionId, assignments } = dto;

    // 1. Lấy thông tin buổi học và tính khung giờ 120 phút
    const session = await this.sessionRepository.findOneBy({
      id: classSessionId,
    });
    if (!session) {
      throw new NotFoundException(
        `Không tìm thấy buổi học với ID ${classSessionId}`,
      );
    }
    let sessionDateStr: string | null = null;
    try {
      if (session.sessionDate instanceof Date) {
        // Nếu là Date object, dùng fromJSDate
        sessionDateStr = DateTime.fromJSDate(session.sessionDate).toISODate();
      } else if (typeof session.sessionDate === 'string') {
        // Nếu là string (vd: '2025-10-22' hoặc '2025-10-22T17:00:00.000Z'), dùng fromISO
        sessionDateStr = DateTime.fromISO(session.sessionDate).toISODate();
      }
    } catch (parseError) {
      console.error(
        'Lỗi parse ngày:',
        parseError,
        'Giá trị gốc:',
        session.sessionDate,
      );
      throw new Error('Định dạng ngày của buổi học không hợp lệ.');
    }
    if (!sessionDateStr) {
      throw new Error('Không thể xác định ngày từ buổi học.');
    }

    const newSessionActualStart = DateTime.fromISO(
      `${sessionDateStr}T${session.startTime}`,
      { zone: VN_TIMEZONE },
    );
    const newSessionPaidStart = newSessionActualStart.minus({ minutes: 15 });
    const newSessionPaidEnd = newSessionActualStart.plus({ minutes: 90 + 15 });
    const newSessionInterval = Interval.fromDateTimes(
      newSessionPaidStart,
      newSessionPaidEnd,
    );

    // 2. Kiểm tra trùng lặp cho TẤT CẢ nhân viên trong danh sách gán
    const staffIdsToCheck = assignments.map((a) => a.staffId);
    if (staffIdsToCheck.length > 0) {
      // Tìm tất cả lịch trình (ca + buổi) của các nhân viên này VÀO NGÀY ĐÓ
      // loại trừ chính buổi học này (để cho phép cập nhật)
      const existingSchedules = await this.scheduleRepository.find({
        where: {
          staffId: In(staffIdsToCheck),
          date: sessionDateStr,
          classSessionId: Not(classSessionId), // Loại trừ chính buổi học này
        },
        relations: ['staff', 'shift', 'classSession'],
      });

      for (const assignment of assignments) {
        const staffExistingSchedules = existingSchedules.filter(
          (s) => s.staffId === assignment.staffId,
        );

        for (const existing of staffExistingSchedules) {
          let existingInterval: Interval | null = null;
          if (existing.shift) {
            const start = DateTime.fromISO(
              `${existing.date}T${existing.shift.startTime}`,
              { zone: VN_TIMEZONE },
            );
            const end = DateTime.fromISO(
              `${existing.date}T${existing.shift.endTime}`,
              { zone: VN_TIMEZONE },
            );
            existingInterval = Interval.fromDateTimes(start, end);

            // Nếu trùng lặp với ca làm việc -> BÁO LỖI
            if (
              existingInterval &&
              newSessionInterval.overlaps(existingInterval)
            ) {
              const staffName =
                existing.staff?.fullName || `ID ${assignment.staffId}`;
              throw new ConflictException(
                `Nhân viên ${staffName} đã có ca làm việc (ca ${existing.shift.name}) bị trùng giờ vào ngày ${sessionDateStr}.`,
              );
            }
          }
        }
      }
    }

    // 3. Nếu không có trùng lặp, tiến hành xóa cũ, tạo mới
    return this.scheduleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        await transactionalEntityManager.delete(StaffScheduleEntity, {
          classSessionId,
        });

        if (!assignments || assignments.length === 0) {
          return [];
        }

        const schedulesToCreate = assignments.map((assignment) => {
          return transactionalEntityManager.create(StaffScheduleEntity, {
            classSessionId: classSessionId,
            staffId: assignment.staffId,
            roleKey: assignment.roleKey,
            date: sessionDateStr,
            shiftId: null,
          });
        });

        return transactionalEntityManager.save(schedulesToCreate);
      },
    );
  }

  async findTodayTeachingSchedules(staffId: number): Promise<any[]> {
    // Kiểu trả về là mảng bất kỳ
    const today = DateTime.now().setZone(VN_TIMEZONE).toISODate();

    const results = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoin('schedule.classSession', 'classSession')
      .leftJoin('classSession.class', 'class')

      // --- THAY ĐỔI: Sử dụng .select() để chọn các cột cụ thể ---
      .select([
        'schedule.date AS date', // Lấy cột 'date' từ bảng 'schedule'
        'class.className AS "className"', // Lấy 'className' từ bảng 'class'
        'class.classCode AS "classCode"', // Lấy 'classCode' từ bảng 'class'
        'classSession.startTime AS "startTime"', // Lấy 'startTime' để sắp xếp
      ])

      .where('schedule.staffId = :staffId', { staffId })
      .andWhere('schedule.date = :today', { today })
      .andWhere('schedule.classSessionId IS NOT NULL')

      .orderBy('"startTime"', 'ASC') // Sắp xếp theo alias 'startTime'

      // --- THAY ĐỔI: Dùng .getRawMany() ---
      .getRawMany(); // Trả về kết quả thô (raw JSON) thay vì

    // Xử lý để loại bỏ startTime nếu bạn không cần nó trong response cuối cùng
    console.log('Kết quả truy vấn thô:', results);
    return results.map((item) => ({
      time: item.startTime,
      className: item.className,
      classCode: item.classCode,
    }));
  }
}
