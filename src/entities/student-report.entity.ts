// src/entities/student-report.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { StudentEntity } from './student.entity';
import { ClassEntity } from './class.entity';
import { ReportFileEntity } from './report-file.entity';
import { ReportLinkEntity } from './report-link.entity';

@Entity('student_reports')
export class StudentReportEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'studentId' })
  student: StudentEntity;

  @Column()
  studentId: number;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'classId' })
  class: ClassEntity;

  @Column()
  classId: number;

  @OneToMany(() => ReportFileEntity, (file) => file.report, { cascade: true })
  files: ReportFileEntity[];

  @OneToMany(() => ReportLinkEntity, (link) => link.report, { cascade: true })
  links: ReportLinkEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ unique: true, nullable: true })
  accessToken: string;

  @BeforeInsert()
  generateAccessToken() {
    this.accessToken = generateRandomToken(12);
  }
}
function generateRandomToken(length = 12) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}
