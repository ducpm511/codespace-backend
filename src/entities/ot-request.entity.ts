// src/entities/ot-request.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { StaffEntity } from './staff.entity';

export enum OtRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Unique(['staffId', 'date'])
@Entity('ot_requests')
export class OtRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StaffEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;
  @Column()
  staffId: number;

  @Column({ type: 'date' })
  date: string; // Ngày phát sinh OT

  @Column({ type: 'interval' })
  detectedDuration: string; // Thời gian OT hệ thống phát hiện

  @Column({ type: 'interval', nullable: true })
  approvedDuration: string | null; // Thời gian OT được quản lý duyệt

  @Column({ type: 'text', nullable: true })
  reason: string; // Lý do làm OT (nhân viên có thể điền)

  @Column({ type: 'text', nullable: true })
  notes: string; // Ghi chú của người duyệt

  @Column({ type: 'varchar', nullable: true })
  approvedRoleKey: string | null; // Ví dụ: 'part-time', 'teacher'

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  approvedMultiplier: number | null; // Ví dụ: 1.5, 2.0

  @Column({
    type: 'enum',
    enum: OtRequestStatus,
    default: OtRequestStatus.PENDING,
  })
  status: OtRequestStatus;

  @Column({ type: 'json', nullable: true })
  breakdown: { role: string; duration: string; multiplier: number }[] | null;

  @ManyToOne(() => StaffEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approverId' })
  approver: StaffEntity | null;
  @Column({ nullable: true })
  approverId: number | null;
}
