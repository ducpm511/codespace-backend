// src/entities/report-link.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentReportEntity } from './student-report.entity';

export enum ReportLinkType {
  PROJECT = 'PROJECT',
  YOUTUBE = 'YOUTUBE',
  SCRATCH_EMBED = 'SCRATCH_EMBED',
}

@Entity('report_links')
export class ReportLinkEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ReportLinkType })
  type: ReportLinkType;

  @Column({ type: 'text' })
  urlOrEmbedCode: string;

  @ManyToOne(() => StudentReportEntity, (report) => report.links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: StudentReportEntity;

  @Column()
  reportId: number;

  @Column({ nullable: true })
  projectName?: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;
}
