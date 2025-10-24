import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffScheduleEntity } from '../entities/staff-schedule.entity';
import { CreateStaffScheduleDto } from './dto/create-staff-schedule.dto';
import { DateTime } from 'luxon';
import { BulkAssignDto } from './dto/bulk-asign.dto';
import { ClassSessionEntity } from 'src/entities/class-session.entity';
import { UpdateStaffScheduleDto } from './dto/update-staff-schedule.dto';

@Injectable()
export class StaffSchedulesService {
  constructor(
    @InjectRepository(StaffScheduleEntity)
    private readonly scheduleRepository: Repository<StaffScheduleEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly sessionRepository: Repository<ClassSessionEntity>,
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
    // Thay đổi kiểu trả về
    const { staffId, shiftId, fromDate, toDate, daysOfWeek } = dto;
    const schedulesToCreate: Partial<StaffScheduleEntity>[] = [];
    const skippedDates: string[] = []; // Lưu các ngày bị bỏ qua do trùng lịch

    // 1. Lấy tất cả lịch trình hiện có của nhân viên trong khoảng thời gian
    // const existingSchedules = await this.scheduleRepository.find({
    //   where: {
    //     staffId: staffId,
    //     date: Between(fromDate, toDate),
    //   },
    //   select: ['date'], // Chỉ cần lấy ngày để kiểm tra
    // });
    // const existingDates = new Set(existingSchedules.map((s) => s.date)); // Dùng Set để kiểm tra nhanh

    // 2. Lặp qua các ngày để tạo lịch mới
    let currentDate = DateTime.fromISO(fromDate);
    const endDate = DateTime.fromISO(toDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISODate();
      const isoWeekday = currentDate.weekday;
      const jsWeekday = isoWeekday % 7;

      // Kiểm tra xem ngày này có thuộc các ngày được chọn VÀ chưa có lịch nào khác
      if (daysOfWeek.includes(jsWeekday)) {
        // if (existingDates.has(dateStr)) {
        //   // Nếu ngày đã có lịch -> thêm vào danh sách bỏ qua
        //   skippedDates.push(dateStr);
        // } else {
        //   // Nếu ngày trống -> thêm vào danh sách sẽ tạo
        //   schedulesToCreate.push({ staffId, shiftId, date: dateStr });
        // }
        schedulesToCreate.push({ staffId, shiftId, date: dateStr });
      }
      currentDate = currentDate.plus({ days: 1 });
    }

    // 3. Lưu các lịch hợp lệ
    if (schedulesToCreate.length > 0) {
      const created = await this.scheduleRepository.save(schedulesToCreate);
      return { created, skipped: skippedDates };
    } else {
      // Nếu không có lịch nào được tạo (do trùng hết)
      return { created: [], skipped: skippedDates };
    }
  }
  async bulkAssignSession(dto: BulkAssignDto): Promise<StaffScheduleEntity[]> {
    const { classSessionId, assignments } = dto;

    return this.scheduleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const session = await transactionalEntityManager.findOneBy(
          ClassSessionEntity,
          { id: classSessionId },
        );
        if (!session) {
          throw new NotFoundException(
            `Không tìm thấy buổi học với ID ${classSessionId}`,
          );
        }
        let sessionDateStr: string | null = null;
        try {
          if (session.sessionDate instanceof Date) {
            // Nếu là Date object, dùng fromJSDate
            sessionDateStr = DateTime.fromJSDate(
              session.sessionDate,
            ).toISODate();
          } else if (typeof session.sessionDate === 'string') {
            // Nếu là string (vd: '2025-10-22'), dùng fromISO
            sessionDateStr = DateTime.fromISO(session.sessionDate).toISODate();
          }
        } catch (parseError) {
          // Bắt lỗi nếu cả hai cách parse đều không thành công
          console.error(
            'Lỗi parse ngày:',
            parseError,
            'Giá trị gốc:',
            session.sessionDate,
          );
          throw new Error('Định dạng ngày của buổi học không hợp lệ.');
        }

        // Kiểm tra lại sau khi parse
        if (!sessionDateStr) {
          throw new Error('Không thể xác định ngày từ buổi học.');
        }

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
}
