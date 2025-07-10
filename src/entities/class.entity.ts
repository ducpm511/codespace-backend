// src/entities/class.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany, // <-- THÊM: Import ManyToMany
  CreateDateColumn, // Thêm để lưu thời gian tạo bản ghi
  UpdateDateColumn, // Thêm để lưu thời gian cập nhật bản ghi
} from 'typeorm';
import { StudentEntity } from './student.entity'; // Import Student entity
import { ClassSessionEntity } from './class-session.entity'; // Import ClassSessionEntity

@Entity('classes')
export class ClassEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  className: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  classCode: string;

  // --- Các trường mới cho lịch học của lớp ---
  @Column({ type: 'date', nullable: true }) // Ngày bắt đầu của lớp (ví dụ: '2025-06-06')
  startDate: Date | null;

  @Column({ type: 'int', nullable: true }) // Tổng số buổi học dự kiến (ví dụ: 48)
  totalSessions: number | null;

  // Lưu trữ các ngày trong tuần mà lớp học diễn ra (ví dụ: ['Friday', 'Monday'])
  // Sử dụng 'jsonb' cho PostgreSQL hoặc 'json' cho MySQL. Đảm bảo TypeORM mapping đúng.
  @Column({ type: 'jsonb', nullable: true })
  scheduleDays: string[] | null;

  @Column({ type: 'time', nullable: true }) // Thời gian cụ thể của buổi học trong ngày (ví dụ: '18:00:00')
  scheduleTime: string | null;
  // --- Kết thúc các trường mới cho lịch học ---

  @Column({ type: 'varchar', length: 50, nullable: true })
  academicYear: string | null; // Năm học

  // Mối quan hệ ManyToMany với StudentEntity
  // Một lớp học có NHIỀU học sinh. Mối quan hệ này khớp với thuộc tính 'classes' trong StudentEntity.
  // @JoinTable chỉ cần định nghĩa trên một phía của mối quan hệ ManyToMany (chúng ta đã làm trong StudentEntity)
  @ManyToMany(() => StudentEntity, (student) => student.classes) // <-- ĐIỀU CHỈNH LẠI DÒNG NÀY
  students: StudentEntity[];

  // Mối quan hệ OneToMany với ClassSessionEntity vẫn giữ nguyên
  @OneToMany(() => ClassSessionEntity, (session) => session.class)
  classSessions: ClassSessionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
