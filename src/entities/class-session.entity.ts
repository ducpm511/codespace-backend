// src/entities/class-session.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany, // Import OneToMany
} from 'typeorm';
import { ClassEntity } from '../entities/class.entity'; // <-- Đổi thành ClassEntity
import { AttendanceEntity } from './attendance.entity'; // Import AttendanceEntity

@Entity('class_sessions')
export class ClassSessionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  sessionDate: Date; // Ngày diễn ra buổi học

  @Column({ type: 'time' })
  startTime: string; // Thời gian bắt đầu (ví dụ: '18:00'), có thể lấy từ Class.scheduleTime

  @Column({ type: 'integer', nullable: true }) // Số thứ tự của buổi học (VD: 1, 2, ..., 48)
  sessionNumber: number;

  @ManyToOne(() => ClassEntity, (cls) => cls.classSessions, {
    // <-- Đổi thành ClassEntity
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classId' }) // <-- Đổi tên cột khóa ngoại
  class: ClassEntity; // <-- Đổi tên thuộc tính

  @Column({ type: 'integer' })
  classId: number; // <-- Đổi tên khóa ngoại

  @OneToMany(() => AttendanceEntity, (attendance) => attendance.classSession)
  attendances: AttendanceEntity[]; // Mối quan hệ 1-n với Attendance
}
