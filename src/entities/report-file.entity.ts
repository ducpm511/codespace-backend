// src/entities/report-file.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentReportEntity } from './student-report.entity';

@Entity('report_files')
export class ReportFileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fileName: string;

  @Column({ type: 'text' })
  fileUrl: string; // Link đến file PDF (trên Cloudinary)

  @ManyToOne(() => StudentReportEntity, (report) => report.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: StudentReportEntity;

  @Column()
  reportId: number;

  @Column({ nullable: true })
  testType: 'midterm' | 'final' | 'certificate';

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number;
}
