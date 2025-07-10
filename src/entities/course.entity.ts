import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ClassSessionEntity } from './class-session.entity';

@Entity('courses') // Đặt tên bảng trong database là 'courses'
export class CourseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string; // Tên khóa học

  @Column({ type: 'integer' })
  numberOfSessions: number; // Số buổi học

  @Column({ type: 'varchar', length: 50 })
  programmingLanguage: string; // Ngôn ngữ lập trình

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  tuitionFee: number; // Học phí

  @Column({ type: 'text', nullable: true })
  discount: string; // Ưu đãi (nếu có)

  @Column({ type: 'text', nullable: true })
  description: string; // Mô tả khóa học

  // @OneToMany(() => ClassSessionEntity, (classSession) => classSession.course)
  // classSessions: ClassSessionEntity[];
}
