import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../entities/parent.entity';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { StudentEntity } from '../entities/student.entity'; // Import StudentEntity

@Injectable()
export class ParentService {
  constructor(
    @InjectRepository(ParentEntity)
    private readonly parentRepository: Repository<ParentEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
  ) {}

  async create(createParentDto: CreateParentDto): Promise<ParentEntity> {
    const parent = this.parentRepository.create(createParentDto);
    return await this.parentRepository.save(parent);
  }

  async findAll(): Promise<ParentEntity[]> {
    return await this.parentRepository.find();
  }

  async findOne(id: number): Promise<ParentEntity> {
    const parent = await this.parentRepository.findOne({ where: { id } });
    if (!parent) {
      throw new NotFoundException(`Không tìm thấy phụ huynh có ID ${id}`);
    }
    return parent;
  }

  async update(
    id: number,
    updateParentDto: UpdateParentDto,
  ): Promise<ParentEntity> {
    const parent = await this.findOne(id);
    this.parentRepository.merge(parent, updateParentDto);
    return await this.parentRepository.save(parent);
  }

  async remove(id: number): Promise<void> {
    const result = await this.parentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy phụ huynh có ID ${id}`);
    }
  }

  async findStudents(parentId: number): Promise<StudentEntity[]> {
    const parent = await this.findOne(parentId);
    return await this.studentRepository.find({
      where: { parent: { id: parent.id } },
    });
  }
}
