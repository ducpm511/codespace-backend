import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StaffEntity } from './staff.entity';

export enum AttendanceType {
  CHECK_IN = 'check-in',
  CHECK_OUT = 'check-out',
}

@Entity('staff_attendances')
export class StaffAttendanceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StaffEntity, (staff) => staff.attendances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;
  @Column()
  staffId: number;

  @Column({ type: 'timestamptz' }) // Thời gian chính xác của lần quét mã
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: AttendanceType,
  })
  type: AttendanceType; // 'check-in' hoặc 'check-out'
}
