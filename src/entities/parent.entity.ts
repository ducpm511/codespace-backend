// src/entities/parent.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { StudentEntity } from './student.entity'; // Import StudentEntity từ thư mục entities chung

@Entity('parents') // Đặt tên bảng trong database là 'parents'
export class ParentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  fullName: string; // Họ và tên phụ huynh

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string; // Số điện thoại

  @Column({ type: 'varchar', length: 255, nullable: true }) // <-- THÊM DÒNG NÀY: Email (tùy chọn trong DTO)
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string; // Địa chỉ

  @Column({ type: 'varchar', length: 255, nullable: true }) // <-- ĐIỀU CHỈNH: Nghề nghiệp trở thành nullable
  job: string | null; // Nghề nghiệp

  // Mối quan hệ one-to-many với Student (một phụ huynh có thể có nhiều học viên)
  @OneToMany(() => StudentEntity, (student) => student.parent)
  students: StudentEntity[];
}
