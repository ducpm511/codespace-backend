// src/attendance/attendance.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm'; // Import Raw for flexible date comparison
import * as dayjs from 'dayjs';
import 'dayjs/locale/vi';
// Đã loại bỏ hoàn toàn các import plugin dayjs:
// import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
// import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import { AttendanceEntity } from '../entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { RecordQrAttendanceDto } from '../attendance/dto/record-qr-attendance.dto';
import { StudentEntity } from '../entities/student.entity';
import { ClassSessionEntity } from '../entities/class-session.entity';
import { ClassEntity } from '../entities/class.entity';
import { HolidayEntity } from 'src/entities/holidays.entity';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import * as Holidays from 'date-holidays';

dayjs.locale('vi'); // Use Vietnamese locale
// Đã loại bỏ hoàn toàn các lệnh mở rộng plugin:
// dayjs.extend(isSameOrAfter);
// dayjs.extend(isSameOrBefore);

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionRepository: Repository<ClassSessionEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepository: Repository<ClassEntity>,
    @InjectRepository(HolidayEntity)
    private readonly holidayRepository: Repository<HolidayEntity>,
  ) {}

  async create(
    createAttendanceDto: CreateAttendanceDto,
  ): Promise<AttendanceEntity> {
    const attendance = this.attendanceRepository.create(createAttendanceDto);
    return await this.attendanceRepository.save(attendance);
  }

  async findAll(): Promise<AttendanceEntity[]> {
    return await this.attendanceRepository.find({
      relations: ['student', 'classSession', 'classSession.class'],
    });
  }

  async findOne(id: number): Promise<AttendanceEntity> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id },
      relations: ['student', 'classSession', 'classSession.class'],
    });
    if (!attendance) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi điểm danh có ID ${id}`,
      );
    }
    return attendance;
  }

  async update(
    id: number,
    updateAttendanceDto: UpdateAttendanceDto,
  ): Promise<AttendanceEntity> {
    const attendance = await this.findOne(id);
    this.attendanceRepository.merge(attendance, updateAttendanceDto);
    return await this.attendanceRepository.save(attendance);
  }

  async remove(id: number): Promise<void> {
    const result = await this.attendanceRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi điểm danh có ID ${id}`,
      );
    }
  }

  async recordAttendanceByQr(
    recordQrAttendanceDto: RecordQrAttendanceDto,
  ): Promise<{ attendance: AttendanceEntity; history: any[] }> {
    const { qrCodeData } = recordQrAttendanceDto;

    const studentIdMatch = qrCodeData.match(/^student_id:(\d+)$/);
    if (!studentIdMatch || !studentIdMatch[1]) {
      throw new BadRequestException(
        'Mã QR không hợp lệ. Định dạng phải là "student_id:ID"',
      );
    }
    const studentId = parseInt(studentIdMatch[1], 10);

    const student = await this.studentRepository.findOne({
      where: { id: studentId },
      relations: ['classes'], // Assume student has a relationship with multiple classes
    });

    if (!student) {
      throw new NotFoundException(
        `Không tìm thấy học sinh với ID: ${studentId}`,
      );
    }

    // Get the student's primary class (or find the class that has a current session)
    // For simplicity, assume the student belongs to one class or we will take the first class
    if (!student.classes || student.classes.length === 0) {
      throw new BadRequestException(
        `Học sinh ${student.fullName} chưa được phân vào lớp nào.`,
      );
    }
    // IMPORTANT: A student can be in multiple classes.
    // We need to find the CURRENTLY RELEVANT class based on time/day.
    // For now, we take the first class, which might be too strict.
    // Consider how to select the correct class if student is in multiple.
    const primaryClass = student.classes[0];

    if (
      !primaryClass ||
      !primaryClass.scheduleDays ||
      !primaryClass.scheduleTime
    ) {
      throw new BadRequestException(
        `Lớp học của học sinh ${student.fullName} chưa có lịch học được thiết lập.`,
      );
    }

    const currentTime = dayjs(); // Current scan time (e.g., 2025-06-09 14:55:00)
    const todayFormatted = currentTime.format('YYYY-MM-DD'); // Current date (e.g., "2025-06-09")
    const currentDayOfWeek = currentTime.format('dddd'); // Current day of week (e.g., "Thứ Hai")

    // Cập nhật daysOfWeekMap để khớp với định dạng "thứ ba", "chủ nhật" từ log
    const daysOfWeekMap = {
      'chủ nhật': 'Sunday',
      'thứ hai': 'Monday',
      'thứ ba': 'Tuesday',
      'thứ tư': 'Wednesday',
      'thứ năm': 'Thursday',
      'thứ sáu': 'Friday',
      'thứ bảy': 'Saturday',
    };
    const currentDayOfWeekEnglish =
      daysOfWeekMap[currentDayOfWeek] || currentDayOfWeek;

    // First, check if today is a scheduled day for the primary class
    if (!primaryClass.scheduleDays.includes(currentDayOfWeekEnglish)) {
      throw new NotFoundException(
        `Không có buổi học nào được lên lịch cho lớp ${primaryClass.className} vào ngày hôm nay (${currentDayOfWeek}).`,
      );
    }

    // Parse primaryClass.scheduleTime (e.g., "14:50:00") and set it for today's date
    const [scheduledHour, scheduledMinute, scheduledSecond] =
      primaryClass.scheduleTime.split(':').map(Number);
    // Create a dayjs object for the scheduled time on the current date
    const scheduledSessionTimeToday = dayjs()
      .hour(scheduledHour)
      .minute(scheduledMinute)
      .second(scheduledSecond || 0)
      .millisecond(0);

    // Define attendance window (e.g., 30 minutes before and 30 minutes after scheduled time)
    const ATTENDANCE_WINDOW_MINUTES = 30;
    const attendanceWindowStart = scheduledSessionTimeToday.subtract(
      ATTENDANCE_WINDOW_MINUTES,
      'minute',
    );
    const attendanceWindowEnd = scheduledSessionTimeToday.add(
      ATTENDANCE_WINDOW_MINUTES,
      'minute',
    );

    // MANUAL IMPLEMENTATION OF isBetween using getTime() for direct comparison
    // This avoids reliance on dayjs plugins entirely.
    const isInAttendanceWindow =
      currentTime.toDate().getTime() >=
        attendanceWindowStart.toDate().getTime() &&
      currentTime.toDate().getTime() <= attendanceWindowEnd.toDate().getTime();

    if (!isInAttendanceWindow) {
      throw new NotFoundException(
        `Bạn không thể điểm danh cho lớp ${primaryClass.className} vào thời điểm này. Vui lòng điểm danh trong khoảng ${attendanceWindowStart.format('HH:mm')} - ${attendanceWindowEnd.format('HH:mm')}.`,
      );
    }

    // 1. Find the ClassSession for this class and today's date (ignoring time for initial find)
    // This assumes there's only one session per class per day, which is implied by single scheduleTime.
    const classSession = await this.classSessionRepository.findOne({
      where: {
        classId: primaryClass.id,
        sessionDate: Raw(
          (alias) => `DATE(${alias}) = DATE('${todayFormatted}')`,
        ),
      },
    });

    if (!classSession) {
      // This case should ideally be caught by generateClassSessions, but it's a fallback.
      throw new NotFoundException(
        `Không có buổi học nào được tìm thấy cho lớp ${primaryClass.className} vào ngày hôm nay (${currentDayOfWeek}). Vui lòng kiểm tra lại lịch học.`,
      );
    }

    // 2. Check if the student has already been marked present for this session
    let existingAttendance = await this.attendanceRepository.findOne({
      where: {
        studentId: student.id,
        classSessionId: classSession.id,
      },
    });

    if (existingAttendance) {
      // If a record exists, update status if necessary or just return the existing record
      if (existingAttendance.status !== 'present') {
        existingAttendance.status = 'present';
        existingAttendance.attendanceTime = new Date();
        await this.attendanceRepository.save(existingAttendance);
      }
    } else {
      // If no record exists, create a new attendance record
      const newAttendance = this.attendanceRepository.create({
        studentId: student.id,
        classSessionId: classSession.id,
        attendanceTime: new Date(),
        status: 'present',
      });
      existingAttendance = await this.attendanceRepository.save(newAttendance);
    }

    // GẮN ĐỐI TƯỢNG HỌC SINH VÀO ĐÂY để nó được trả về trong phản hồi API
    existingAttendance.student = student;

    // 3. Get student's attendance history for this class
    const attendanceHistory = await this.getAttendanceHistoryForClass(
      student.id,
      primaryClass.id,
    );

    return {
      attendance: existingAttendance,
      history: attendanceHistory,
    };
  }

  async getAttendanceHistoryForClass(
    studentId: number,
    classId: number,
  ): Promise<any[]> {
    const history = await this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.student', 'student')
      .leftJoinAndSelect('attendance.classSession', 'session')
      .leftJoinAndSelect('session.class', 'class')
      .where('attendance.studentId = :studentId', { studentId })
      .andWhere('session.classId = :classId', { classId })
      .orderBy('session.sessionDate', 'DESC')
      .addOrderBy('session.startTime', 'DESC')
      .select([
        'attendance.status',
        'attendance.attendanceTime',
        'session.sessionDate',
        'session.sessionNumber',
        'session.startTime',
        'class.className',
        'class.classCode',
      ])
      .getRawMany();

    return history.map((item) => ({
      status: item.attendance_status,
      attendanceTime: item.attendance_attendanceTime,
      sessionDate: dayjs(item.session_sessionDate).format('DD/MM/YYYY'),
      sessionNumber: item.session_sessionNumber,
      sessionStartTime: item.session_startTime,
      className: item.class_className,
      classCode: item.class_classCode,
    }));
  }

  async generateClassSessions(classId: number): Promise<void> {
    const cls = await this.classRepository.findOne({ where: { id: classId } });
    let holidayDates = await this.holidayRepository.find();
    if (!holidayDates || holidayDates.length === 0) {
      // Nếu không có ngày nghỉ trong DB, lấy từ date-holidays cho năm hiện tại
      const hd = new (Holidays as any)();
      hd.init('VN'); // Sử dụng 'VN' cho Việt Nam
      console.log('Fetching holidays from date-holidays for current year');

      const currentYear = dayjs().year();
      const allHolidays = hd.getHolidays(currentYear);
      // Chuyển đổi thành mảng giống holidayDates
      holidayDates = allHolidays.map((h: any, idx: number) => ({
        id: idx, // Assign a temporary id, or use 0 if not needed
        holidayDate: h.date, // ISO string
        name: h.name,
        reason: h.name || 'Holiday', // Use name as reason or provide a default
      }));
    }
    const holidayDateStrings = holidayDates.map((h) =>
      dayjs(h.holidayDate).format('YYYY-MM-DD'),
    );
    const skippedDates: string[] = []; // Lưu danh sách ngày bị bỏ

    if (
      !cls ||
      !cls.startDate ||
      cls.totalSessions === null ||
      !cls.scheduleDays ||
      cls.scheduleDays.length === 0 ||
      !cls.scheduleTime
    ) {
      return;
    }

    // --- NEW: Delete existing sessions for this class before generating new ones ---
    try {
      const deleteResult = await this.classSessionRepository.delete({
        classId: cls.id,
      });
      console.log(
        `Successfully deleted ${deleteResult.affected || 0} existing sessions for class ID ${cls.id}.`,
      );
    } catch (deleteError) {
      console.error(
        `Error deleting existing sessions for class ID ${cls.id}:`,
        deleteError,
      );
      // Ghi log lỗi chi tiết hơn nếu có thể
      if (deleteError instanceof Error) {
        console.error('Delete error message:', deleteError.message);
        console.error('Delete error stack:', deleteError.stack);
      }
    }
    // --- END NEW ---

    const sessionsToCreate: ClassSessionEntity[] = [];
    let currentSessionDate = dayjs(cls.startDate);
    let sessionCounter = 1;

    const MAX_DAYS_TO_SCAN = cls.totalSessions * 7 * 2;
    let daysScanned = 0;

    while (
      sessionCounter <= cls.totalSessions &&
      daysScanned < MAX_DAYS_TO_SCAN
    ) {
      const dayOfWeekVietnamese = currentSessionDate.format('dddd');

      // Cập nhật daysOfWeekMap để khớp với định dạng "thứ ba", "chủ nhật" từ log
      const daysOfWeekMap = {
        'chủ nhật': 'Sunday',
        'thứ hai': 'Monday',
        'thứ ba': 'Tuesday',
        'thứ tư': 'Wednesday',
        'thứ năm': 'Thursday',
        'thứ sáu': 'Friday',
        'thứ bảy': 'Saturday',
      };
      const currentDayOfWeekEnglish =
        daysOfWeekMap[dayOfWeekVietnamese] || dayOfWeekVietnamese;

      const formattedSessionDate = currentSessionDate.format('YYYY-MM-DD');

      // Nếu là ngày nghỉ lễ thì bỏ qua
      if (holidayDateStrings.includes(formattedSessionDate)) {
        console.log(`Skipping holiday: ${formattedSessionDate}`);
        skippedDates.push(formattedSessionDate);
        currentSessionDate = currentSessionDate.add(1, 'day');
        daysScanned++;
        continue;
      }

      if (cls.scheduleDays.includes(currentDayOfWeekEnglish)) {
        const formattedSessionDate = currentSessionDate.format('YYYY-MM-DD');

        const existingSession = await this.classSessionRepository.findOne({
          where: {
            classId: cls.id,
            sessionDate: Raw(
              (alias) => `DATE(${alias}) = DATE('${formattedSessionDate}')`,
            ),
            startTime: cls.scheduleTime,
          },
        });

        if (!existingSession) {
          const newSession = this.classSessionRepository.create({
            classId: cls.id,
            // Store date as a Date object which TypeORM will convert to DATE type
            sessionDate: currentSessionDate.toDate(),
            startTime: cls.scheduleTime,
            sessionNumber: sessionCounter,
          });
          sessionsToCreate.push(newSession);
          sessionCounter++;
        } else {
          if (existingSession.sessionNumber !== sessionCounter) {
            existingSession.sessionNumber = sessionCounter;
            await this.classSessionRepository.save(existingSession);
          }
          sessionCounter++;
        }
      } else {
        console.log(
          `No match for ${currentDayOfWeekEnglish}. Skipping this date.`,
        );
      }
      currentSessionDate = currentSessionDate.add(1, 'day');
      daysScanned++;

      console.log('Skipped holiday dates:', skippedDates);
    }

    if (sessionsToCreate.length > 0) {
      try {
        await this.classSessionRepository.save(sessionsToCreate);
      } catch (bulkSaveError) {
        console.error(
          'CRITICAL ERROR: Error saving class sessions to DB:',
          bulkSaveError,
        );
        if (bulkSaveError instanceof Error) {
          console.error('Bulk save error message:', bulkSaveError.message);
          console.error('Bulk save error stack:', bulkSaveError.stack);
        }
        throw bulkSaveError; // Re-throw to prevent silent failure
      }
    } else {
      console.log('No new sessions to save (sessionsToCreate is empty).');
    }
  }

  async markAbsentees(): Promise<void> {
    const now = dayjs();
    const today = now.toDate();
    const fiveMinutesAgo = now.subtract(5, 'minute').format('HH:mm:ss');

    const sessionsToCheck = await this.classSessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.class', 'class')
      .where('session.sessionDate = :today', { today })
      .andWhere('session.startTime <= :fiveMinutesAgo', { fiveMinutesAgo })
      .getMany();

    for (const session of sessionsToCheck) {
      const studentsInClass = await this.studentRepository
        .createQueryBuilder('student')
        .leftJoin('student.classes', 'class')
        .where('class.id = :classId', { classId: session.classId })
        .getMany();

      for (const student of studentsInClass) {
        const existingAttendance = await this.attendanceRepository.findOne({
          where: {
            studentId: student.id,
            classSessionId: session.id,
          },
        });

        if (!existingAttendance) {
          const absentAttendance = this.attendanceRepository.create({
            studentId: student.id,
            classSessionId: session.id,
            attendanceTime: null,
            status: 'absent',
          });
          await this.attendanceRepository.save(absentAttendance);
        }
      }
    }
  }

  async updateClassSession(id: number, dto: UpdateClassSessionDto) {
    const session = await this.classSessionRepository.findOne({
      where: { id },
    });
    console.log('Updating class session:', session);
    console.log('Update DTO:', dto);
    if (!session)
      throw new NotFoundException(`Không tìm thấy buổi học với id ${id}`);

    // Gộp dữ liệu
    this.classSessionRepository.merge(session, dto);

    return await this.classSessionRepository.save(session);
  }
}
