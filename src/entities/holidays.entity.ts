// src/entities/holiday.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('holidays')
export class HolidayEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  holidayDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;
}
