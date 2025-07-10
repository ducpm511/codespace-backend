// src/entities/attendance.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { StudentEntity } from '../entities/student.entity'; // Import StudentEntity
import { ClassSessionEntity } from './class-session.entity'; // Import ClassSessionEntity

@Entity('attendances') // Đặt tên bảng trong database là 'attendances'
export class AttendanceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StudentEntity, (student) => student.attendances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: StudentEntity;

  @Column({ type: 'integer' })
  studentId: number; // Foreign key trỏ đến Student

  @ManyToOne(
    () => ClassSessionEntity,
    (classSession) => classSession.attendances,
    {
      onDelete: 'CASCADE',
      nullable: true, // <-- THÊM DÒNG NÀY: Mối quan hệ này có thể là NULL
    },
  )
  @JoinColumn({ name: 'classSessionId' })
  classSession: ClassSessionEntity | null; // <-- THAY ĐỔI: Cho phép là null

  @Column({ type: 'integer', nullable: true }) // <-- THÊM DÒNG NÀY: Cột khóa ngoại có thể là NULL
  classSessionId: number | null; // <-- THAY ĐỔI: Cho phép là null

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  attendanceTime: Date;

  @Column({
    type: 'enum',
    enum: ['present', 'absent', 'late', 'excused'],
    default: 'absent',
  })
  status: 'present' | 'absent' | 'late' | 'excused'; // Trạng thái điểm danh

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date; // Thời điểm bản ghi được tạo
}
