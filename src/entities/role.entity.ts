import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // Tên hiển thị (ví dụ: "Giáo viên", "Trợ giảng")

  @Column({ unique: true })
  key: string; // Key định danh (ví dụ: "teacher", "ta")
}
