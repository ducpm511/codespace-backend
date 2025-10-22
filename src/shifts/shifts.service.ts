import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftEntity } from '../entities/shift.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(ShiftEntity)
    private readonly shiftRepository: Repository<ShiftEntity>,
  ) {}

  async create(createShiftDto: CreateShiftDto): Promise<ShiftEntity> {
    const newShift = this.shiftRepository.create(createShiftDto);
    console.log('Creating new shift:', newShift);
    return this.shiftRepository.save(newShift);
  }

  async findAll(): Promise<ShiftEntity[]> {
    return this.shiftRepository.find();
  }

  async findOne(id: number): Promise<ShiftEntity> {
    const shift = await this.shiftRepository.findOneBy({ id });
    if (!shift) {
      throw new NotFoundException(`Không tìm thấy ca làm việc với ID ${id}`);
    }
    return shift;
  }

  async update(
    id: number,
    updateShiftDto: UpdateShiftDto,
  ): Promise<ShiftEntity> {
    const shift = await this.findOne(id);
    this.shiftRepository.merge(shift, updateShiftDto);
    return this.shiftRepository.save(shift);
  }

  async remove(id: number): Promise<void> {
    const result = await this.shiftRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy ca làm việc với ID ${id}`);
    }
  }
}
