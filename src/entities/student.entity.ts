// src/entities/student.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ParentEntity } from './parent.entity'; // Import ParentEntity
import { ClassEntity } from './class.entity'; // Import ClassEntity
import { AttendanceEntity } from './attendance.entity'; // Import AttendanceEntity

@Entity('students')
export class StudentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'date' })
  dateOfBirth: Date; // Kiểu Date object

  @Column({ type: 'integer' })
  age: number;

  @Column({ type: 'varchar', length: 10 })
  gender: string;

  @ManyToMany(() => ClassEntity, (cls) => cls.students)
  @JoinTable({
    // Cần @JoinTable cho mối quan hệ ManyToMany
    name: 'student_classes', // Tên bảng trung gian
    joinColumn: { name: 'studentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'classId', referencedColumnName: 'id' },
  })
  classes: ClassEntity[];

  // parentId có thể là NULL
  @Column({ type: 'integer', nullable: true }) // <-- parentId đã nullable
  parentId: number | null; // Cột lưu ID phụ huynh (FK)

  // Mối quan hệ ManyToOne với ParentEntity
  // Một học sinh có MỘT phụ huynh (hoặc không có phụ huynh nào)
  @ManyToOne(() => ParentEntity, (parent) => parent.students, {
    nullable: true, // <-- ĐIỀU CHỈNH: Cho phép học sinh không có phụ huynh
    onDelete: 'SET NULL', // Khi phụ huynh bị xóa, parentId trong học sinh sẽ thành NULL
  })
  @JoinColumn({ name: 'parentId' }) // Tên cột khóa ngoại trong bảng students
  parent: ParentEntity | null; // Đối tượng phụ huynh liên kết

  // Mối quan hệ OneToMany với AttendanceEntity
  // Một học sinh có nhiều bản ghi điểm danh
  @OneToMany(() => AttendanceEntity, (attendance) => attendance.student)
  attendances: AttendanceEntity[];
}
