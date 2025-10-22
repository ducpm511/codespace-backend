import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('shift')
export class ShiftEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'time' })
  startTime: string; // "13:15:00"

  @Column({ type: 'time' })
  endTime: string; // "20:45:00"

  @Column({ type: 'interval', default: '00:00:00' })
  breakDuration: string; // Thời gian nghỉ không lương, ví dụ: "01:00:00"

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1 })
  otMultiplier: number; // Hệ số nhân lương OT, mặc định 100%
}
