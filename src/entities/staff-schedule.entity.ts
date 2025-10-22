// src/entities/staff-schedule.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StaffEntity } from './staff.entity';
import { ShiftEntity } from './shift.entity';
import { ClassSessionEntity } from './class-session.entity';
import { RoleEntity } from './role.entity';

@Entity('staff_schedules')
export class StaffScheduleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string; // Ngày được phân công

  @ManyToOne(() => StaffEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;
  @Column()
  staffId: number;

  // Một lịch có thể là một ca cố định...
  @ManyToOne(() => ShiftEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shiftId' })
  shift: ShiftEntity | null;
  @Column({ nullable: true })
  shiftId: number | null;

  @Column({
    type: 'varchar',
    nullable: true,
    comment: 'Key của vai trò (liên kết với RoleEntity.key)',
  })
  roleKey: string | null;

  // ...hoặc là một buổi dạy học cụ thể
  @ManyToOne(() => ClassSessionEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classSessionId' })
  classSession: ClassSessionEntity | null;
  @Column({ nullable: true })
  classSessionId: number | null;

  @ManyToOne(() => RoleEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleKey', referencedColumnName: 'key' }) // Join bằng key
  role: RoleEntity | null;
}
