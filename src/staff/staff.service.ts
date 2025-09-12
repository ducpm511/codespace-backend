import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffEntity } from '../entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffEntity)
    private readonly staffRepository: Repository<StaffEntity>,
  ) {}

  async create(createStaffDto: CreateStaffDto): Promise<StaffEntity> {
    const staff = this.staffRepository.create(createStaffDto);
    return await this.staffRepository.save(staff);
  }

  async findAll(): Promise<StaffEntity[]> {
    return await this.staffRepository.find();
  }

  async findOne(id: number): Promise<StaffEntity> {
    const staff = await this.staffRepository.findOne({ where: { id } });
    if (!staff) {
      throw new NotFoundException(`Không tìm thấy nhân viên có ID ${id}`);
    }
    return staff;
  }

  async update(
    id: number,
    updateStaffDto: UpdateStaffDto,
  ): Promise<StaffEntity> {
    const staff = await this.findOne(id);
    this.staffRepository.merge(staff, updateStaffDto);
    return await this.staffRepository.save(staff);
  }

  async remove(id: number): Promise<void> {
    const result = await this.staffRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy nhân viên có ID ${id}`);
    }
  }
}
