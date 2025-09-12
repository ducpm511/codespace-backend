// src/classes/classes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AttendanceService } from '../attendance/attendance.service'; // <-- Import AttendanceService
import { ClassSessionEntity } from 'src/entities/class-session.entity';
import { HolidayEntity } from 'src/entities/holidays.entity'; // THAY ĐỔI: Import HolidayEntity
import * as Holidays from 'date-holidays'; // THAY ĐỔI: Import thư viện holiday
import { DateTime } from 'luxon'; // THAY ĐỔI: Import Luxon

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassEntity)
    private classesRepository: Repository<ClassEntity>,
    private readonly attendanceService: AttendanceService, // <-- Inject AttendanceService
    @InjectRepository(ClassSessionEntity)
    private classSessionRepository: Repository<ClassSessionEntity>,
    private readonly dataSource: DataSource,
    @InjectRepository(HolidayEntity)
    private readonly holidayRepository: Repository<HolidayEntity>,
  ) {}

  async create(createClassDto: CreateClassDto): Promise<ClassEntity> {
    const newClass = this.classesRepository.create(createClassDto);
    const savedClass = await this.classesRepository.save(newClass);

    if (
      savedClass.startDate &&
      savedClass.totalSessions &&
      savedClass.schedule?.length > 0
    ) {
      // Gọi hàm generate mới, giờ nó nằm ngay trong service này
      const sessions = await this._generateSessions(savedClass);
      savedClass.classSessions = sessions;
      await this.classesRepository.save(savedClass);
    }
    return savedClass;
  }

  async findAll(): Promise<ClassEntity[]> {
    // Để lấy đủ thông tin lịch học, không cần quan hệ đặc biệt ở đây
    return await this.classesRepository.find();
  }

  async findOne(id: number): Promise<ClassEntity> {
    const classFound = await this.classesRepository.findOneBy({ id });
    if (!classFound) {
      throw new NotFoundException(`Class with ID ${id} not found.`);
    }
    return classFound;
  }

  async update(
    id: number,
    updateClassDto: UpdateClassDto,
  ): Promise<ClassEntity> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const classToUpdate = await transactionalEntityManager.findOne(
        ClassEntity,
        {
          where: { id },
          relations: ['classSessions', 'classSessions.attendances'], // Load cả session và điểm danh của session
        },
      );

      if (!classToUpdate) {
        throw new NotFoundException(`Class with ID ${id} not found.`);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Phân loại và giữ lại các buổi học trong quá khứ
      const pastSessionsToKeep = classToUpdate.classSessions.filter(
        (session) =>
          new Date(session.sessionDate) < today || // Buổi học đã qua ngày
          session.attendances?.length > 0, // HOẶC buổi học đã có người điểm danh
      );

      // 2. Lọc ra các buổi học tương lai để xóa
      const futureSessionsToDelete = classToUpdate.classSessions.filter(
        (session) => !pastSessionsToKeep.some((p) => p.id === session.id),
      );

      // 3. Xóa các buổi học tương lai cũ
      if (futureSessionsToDelete.length > 0) {
        await transactionalEntityManager.remove(futureSessionsToDelete);
      }

      // Merge thông tin mới từ DTO vào entity lớp học
      transactionalEntityManager.merge(
        ClassEntity,
        classToUpdate,
        updateClassDto,
      );

      // 4. Tính toán và tái tạo các buổi học mới cho tương lai
      const remainingSessionsToGenerate =
        (classToUpdate.totalSessions || 0) - pastSessionsToKeep.length;

      let newFutureSessions: ClassSessionEntity[] = [];
      if (
        remainingSessionsToGenerate > 0 &&
        classToUpdate.startDate &&
        classToUpdate.schedule?.length > 0
      ) {
        // Điểm bắt đầu generate là 'hôm nay'
        const generationStartDate =
          new Date() > new Date(classToUpdate.startDate)
            ? new Date()
            : new Date(classToUpdate.startDate);

        newFutureSessions = await this._generateSessions(
          classToUpdate,
          remainingSessionsToGenerate,
          generationStartDate,
          pastSessionsToKeep.length, // Bắt đầu đếm số thứ tự buổi học từ đây
        );
      }
      console.log('New future sessions generated:', newFutureSessions);

      // 5. Gán lại danh sách buổi học cuối cùng và lưu
      classToUpdate.classSessions = [
        ...pastSessionsToKeep,
        ...newFutureSessions,
      ];

      return transactionalEntityManager.save(classToUpdate);
    });
  }

  // --- THAY ĐỔI: Helper riêng để tạo sessions, tái sử dụng logic từ AttendanceService ---
  private async _generateSessions(
    cls: ClassEntity,
    sessionsToGenerate?: number,
    generationStartDate?: Date,
    sessionNumberOffset = 0,
  ): Promise<ClassSessionEntity[]> {
    const totalSessions = sessionsToGenerate ?? cls.totalSessions;
    const startDate = generationStartDate ?? new Date(cls.startDate);

    if (!totalSessions || !cls.schedule || cls.schedule.length === 0) return [];

    // Logic lấy ngày nghỉ lễ (tương tự code cũ)
    let holidayDates = await this.holidayRepository.find();
    if (!holidayDates || holidayDates.length === 0) {
      const hd = new (Holidays as any)();
      hd.init('VN');
      const currentYear = DateTime.now().year;
      holidayDates = hd.getHolidays(currentYear).map((h: any) => ({
        holidayDate: h.date,
        name: h.name,
      }));
    }
    const holidayDateStrings = holidayDates.map((h) =>
      DateTime.fromISO(new Date(h.holidayDate).toISOString()).toFormat(
        'yyyy-MM-dd',
      ),
    );

    const sessionsToCreate: ClassSessionEntity[] = [];
    let sessionCounter = 1;
    let currentDate = DateTime.fromJSDate(startDate);
    const MAX_DAYS_TO_SCAN = totalSessions * 14;
    let daysScanned = 0;

    // Vòng lặp chính để tạo buổi học
    while (sessionCounter <= totalSessions && daysScanned < MAX_DAYS_TO_SCAN) {
      const dayOfWeek = currentDate.toFormat('cccc').trim().toLowerCase(); // 'monday', 'tuesday'
      const formattedDate = currentDate.toFormat('yyyy-MM-dd');

      // Bỏ qua nếu là ngày nghỉ lễ
      if (holidayDateStrings.includes(formattedDate)) {
        currentDate = currentDate.plus({ days: 1 });
        daysScanned++;
        continue;
      }

      // THAY ĐỔI LOGIC TẠI ĐÂY
      // Lọc ra TẤT CẢ các lịch học trong ngày hôm đó
      const schedulesForToday = cls.schedule.filter(
        (s) => s.day.trim().toLowerCase() === dayOfWeek,
      );

      // Nếu có lịch học, lặp qua từng lịch để tạo session
      if (schedulesForToday.length > 0) {
        // Sắp xếp các buổi học theo thời gian để đảm bảo thứ tự
        schedulesForToday.sort((a, b) => a.time.localeCompare(b.time));

        for (const schedule of schedulesForToday) {
          // Dừng lại nếu đã tạo đủ số buổi học
          if (sessionCounter > totalSessions) {
            break;
          }

          sessionsToCreate.push(
            this.classSessionRepository.create({
              classId: cls.id,
              sessionDate: currentDate.toJSDate(),
              startTime: schedule.time,
              sessionNumber: sessionCounter + sessionNumberOffset,
            }),
          );
          sessionCounter++;
        }
      }

      currentDate = currentDate.plus({ days: 1 });
      daysScanned++;
    }
    return sessionsToCreate;
  }

  async remove(id: number): Promise<void> {
    const result = await this.classesRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Class with ID ${id} not found.`);
    }
  }

  // class-attendance.service.ts
  async getAttendanceMatrix(classId: number): Promise<any> {
    // Phiên bản QueryBuilder này là chính xác và mạnh mẽ nhất
    const classData = await this.classesRepository
      .createQueryBuilder('class')
      // Sử dụng alias 'class' để join với thuộc tính 'students'
      .leftJoinAndSelect('class.students', 'student')
      // Từ alias 'class', join tiếp với thuộc tính 'classSessions'
      .leftJoinAndSelect('class.classSessions', 'session')
      // Từ alias 'session', join tiếp với thuộc tính 'attendances'
      .leftJoinAndSelect('session.attendances', 'attendance')
      // Lọc theo ID của class
      .where('class.id = :classId', { classId })
      // Sắp xếp kết quả
      .orderBy('session.sessionDate', 'ASC')
      .addOrderBy('session.startTime', 'ASC')
      .getOne(); // Lấy một đối tượng Class duy nhất với tất cả relations đã join

    if (!classData) {
      throw new NotFoundException(`Không tìm thấy lớp học với ID ${classId}`);
    }

    // Logic map dữ liệu từ đối tượng classData đã được tải đầy đủ
    const students = classData.students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
    }));

    const sessions = classData.classSessions.map((session) => ({
      id: session.id,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      sessionNumber: session.sessionNumber,
      attendances: session.attendances.map((att) => ({
        studentId: att.studentId,
        status: att.status,
      })),
    }));

    return {
      students,
      sessions,
    };
  }
}
