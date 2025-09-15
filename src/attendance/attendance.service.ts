// src/attendance/attendance.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, In } from 'typeorm'; // Import Raw for flexible date comparison
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

import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { DateTime } from 'luxon'; // Import Luxon for date handling
import { ManualAttendanceDto } from './dto/manual-attendance.dto';

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

  async getByStudent(studentId: number): Promise<AttendanceEntity[]> {
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Không tìm thấy học sinh có ID ${studentId}`);
    }
    return await this.attendanceRepository.find({
      where: { studentId },
      relations: ['classSession', 'classSession.class'],
      order: { attendanceTime: 'DESC' },
    });
  }

  async getClassSessionByStudent(
    studentId: number,
  ): Promise<ClassSessionEntity[]> {
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
      relations: ['classes'],
    });

    if (!student) {
      throw new NotFoundException(`Không tìm thấy học sinh có ID ${studentId}`);
    }
    if (!student.classes || student.classes.length === 0) {
      // Trả về mảng rỗng thay vì lỗi, vì học sinh có thể chưa có lớp
      return [];
    }

    const classIds = student.classes.map((cls) => cls.id);

    // Dùng QueryBuilder để join và lọc attendance theo đúng studentId
    return (
      this.classSessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.class', 'class')
        // Join bảng attendance VỚI ĐIỀU KIỆN chỉ lấy attendance của đúng học sinh này
        .leftJoinAndSelect(
          'session.attendances',
          'attendance',
          'attendance.studentId = :studentId',
          { studentId },
        )
        .where('session.classId IN (:...classIds)', { classIds })
        .orderBy('session.sessionDate', 'ASC')
        .addOrderBy('session.startTime', 'ASC')
        .getMany()
    );
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

    // --- Phần lấy student và primaryClass không đổi ---
    const studentIdMatch = qrCodeData.match(/^student_id:(\d+)$/);
    if (!studentIdMatch) {
      throw new BadRequestException(
        'Mã QR không hợp lệ. Định dạng phải là "student_id:ID"',
      );
    }
    const studentId = parseInt(studentIdMatch[1], 10);
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
      relations: ['classes'],
    });
    if (!student) {
      throw new NotFoundException(
        `Không tìm thấy học sinh với ID: ${studentId}`,
      );
    }
    if (!student.classes || student.classes.length === 0) {
      throw new BadRequestException(
        `Học sinh ${student.fullName} chưa được phân vào lớp nào.`,
      );
    }
    const primaryClass = student.classes[0];
    if (!primaryClass?.schedule || primaryClass.schedule.length === 0) {
      throw new BadRequestException(
        `Lớp học của ${student.fullName} chưa có lịch học.`,
      );
    }

    // --- BẮT ĐẦU LOGIC SỬA LỖI ---

    const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
    const currentTimeVN = DateTime.now().setZone(VN_TIMEZONE);
    const todayFormatted = currentTimeVN.toFormat('yyyy-MM-dd');
    const currentDayOfWeek = currentTimeVN.toFormat('cccc').toLowerCase(); // 'monday', 'tuesday'...

    // THAY ĐỔI 1: Lấy TẤT CẢ các lịch học trong ngày, thay vì chỉ 1
    const todaySchedules = primaryClass.schedule.filter(
      (s) => s.day.toLowerCase() === currentDayOfWeek,
    );

    if (todaySchedules.length === 0) {
      throw new NotFoundException(
        `Không có buổi học nào được lên lịch cho lớp ${primaryClass.className} vào hôm nay (${currentDayOfWeek}).`,
      );
    }

    // LOGIC MỚI: Tìm lịch học phù hợp dựa trên time window
    let targetSchedule = null;
    const ATTENDANCE_WINDOW_MINUTES = parseInt(
      process.env.ATTENDANCE_WINDOW_MINUTES || '60',
      10,
    );

    for (const schedule of todaySchedules) {
      const [hour, minute] = schedule.time.split(':').map(Number);
      const scheduledSessionTime = currentTimeVN.set({
        hour,
        minute,
        second: 0,
        millisecond: 0,
      });

      const windowStart = scheduledSessionTime.minus({
        minutes: ATTENDANCE_WINDOW_MINUTES,
      });
      const windowEnd = scheduledSessionTime.plus({
        minutes: ATTENDANCE_WINDOW_MINUTES,
      });

      // Nếu thời gian quét nằm trong khung giờ của lịch học này -> đây chính là buổi học cần điểm danh
      if (currentTimeVN >= windowStart && currentTimeVN <= windowEnd) {
        targetSchedule = schedule;
        break; // Dừng lại khi đã tìm thấy
      }
    }

    if (!targetSchedule) {
      throw new NotFoundException(
        `Bạn không thể điểm danh vào thời điểm này. Vui lòng điểm danh trong khung giờ học.`,
      );
    }

    // THAY ĐỔI 2: Tìm chính xác buổi học bằng cả ngày và giờ bắt đầu
    const classSession = await this.classSessionRepository.findOne({
      where: {
        classId: primaryClass.id,
        sessionDate: Raw(
          (alias) => `DATE(${alias}) = DATE('${todayFormatted}')`,
        ),
        startTime: targetSchedule.time, // Thêm điều kiện startTime để tìm chính xác
      },
    });

    if (!classSession) {
      throw new NotFoundException(
        `Không tìm thấy buổi học cho lớp ${primaryClass.className} vào lúc ${targetSchedule.time} hôm nay.`,
      );
    }

    // --- Phần tạo/cập nhật bản ghi điểm danh không đổi ---
    let existingAttendance = await this.attendanceRepository.findOne({
      where: {
        studentId: student.id,
        classSessionId: classSession.id,
      },
    });

    if (existingAttendance) {
      if (existingAttendance.status !== 'present') {
        existingAttendance.status = 'present';
        existingAttendance.attendanceTime = new Date();
        await this.attendanceRepository.save(existingAttendance);
      }
    } else {
      const newAttendance = this.attendanceRepository.create({
        studentId: student.id,
        classSessionId: classSession.id,
        attendanceTime: new Date(),
        status: 'present',
      });
      existingAttendance = await this.attendanceRepository.save(newAttendance);
    }

    existingAttendance.student = student;
    const attendanceHistory = await this.getAttendanceHistoryForClass(
      student.id,
      primaryClass.id,
    );

    return {
      attendance: existingAttendance,
      history: attendanceHistory,
    };
  }

  async recordManualAttendance(
    manualAttendanceDto: ManualAttendanceDto,
  ): Promise<{ message: string; count: number }> {
    const { studentId, sessionIds } = manualAttendanceDto;

    // 1. Kiểm tra xem học sinh có tồn tại không
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(
        `Không tìm thấy học sinh với ID ${studentId}`,
      );
    }

    // 2. Kiểm tra xem tất cả các buổi học (class sessions) có tồn tại không
    const sessions = await this.classSessionRepository.find({
      where: { id: In(sessionIds) },
    });
    if (sessions.length !== sessionIds.length) {
      const foundIds = sessions.map((s) => s.id);
      const notFoundIds = sessionIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Không tìm thấy các buổi học với ID: ${notFoundIds.join(', ')}`,
      );
    }

    // 3. Lấy tất cả các bản ghi điểm danh đã có của học sinh cho các buổi học này
    const existingAttendances = await this.attendanceRepository.find({
      where: {
        studentId: studentId,
        classSessionId: In(sessionIds),
      },
    });

    // Tạo một map để truy cập nhanh các bản ghi đã có bằng classSessionId
    const existingAttendanceMap = new Map<number, AttendanceEntity>();
    existingAttendances.forEach((att) => {
      if (att.classSessionId) {
        existingAttendanceMap.set(att.classSessionId, att);
      }
    });

    const recordsToSave: AttendanceEntity[] = [];

    // 4. Logic "Upsert": Lặp qua từng session ID để cập nhật hoặc tạo mới
    for (const sessionId of sessionIds) {
      const existingRecord = existingAttendanceMap.get(sessionId);

      if (existingRecord) {
        // Nếu đã có bản ghi -> Cập nhật trạng thái thành 'present'
        if (existingRecord.status !== 'present') {
          existingRecord.status = 'present';
          existingRecord.attendanceTime = new Date(); // Cập nhật thời gian điểm danh
          recordsToSave.push(existingRecord);
        }
      } else {
        // Nếu chưa có bản ghi -> Tạo một bản ghi mới
        const newAttendance = this.attendanceRepository.create({
          studentId: studentId,
          classSessionId: sessionId,
          status: 'present',
          attendanceTime: new Date(),
        });
        recordsToSave.push(newAttendance);
      }
    }

    // 5. Lưu tất cả các thay đổi vào CSDL trong một lần
    // TypeORM's .save() sẽ tự động xử lý cả INSERT và UPDATE
    if (recordsToSave.length > 0) {
      await this.attendanceRepository.save(recordsToSave);
    }

    return {
      message: `Điểm danh thủ công thành công cho học sinh ${student.fullName}.`,
      count: recordsToSave.length,
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
