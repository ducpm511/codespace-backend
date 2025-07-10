import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('staffs') // Đặt tên bảng trong database là 'staffs'
export class StaffEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  fullName: string; // Họ và tên

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string; // Số điện thoại

  @Column({ type: 'date' })
  dateOfBirth: Date; // Ngày tháng năm sinh

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string; // Email (unique)

  @Column({ type: 'varchar', length: 255 })
  address: string; // Địa chỉ

  @Column({ type: 'varchar', length: 20, unique: true })
  identityCardNumber: string; // Căn cước công dân (unique)

  @Column({ type: 'varchar', length: 20 })
  emergencyContactNumber: string; // Số điện thoại liên hệ khẩn cấp

  @Column({ type: 'varchar', length: 100 })
  title: string; // Chức danh
}
