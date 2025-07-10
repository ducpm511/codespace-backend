import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSessionEntity } from '../entities/class-session.entity';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';

@Injectable()
export class ClassSessionService {
  constructor(
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionRepository: Repository<ClassSessionEntity>,
  ) {}

  async create(
    createClassSessionDto: CreateClassSessionDto,
  ): Promise<ClassSessionEntity> {
    const classSession = this.classSessionRepository.create(
      createClassSessionDto,
    );
    return await this.classSessionRepository.save(classSession);
  }

  async findAll(): Promise<ClassSessionEntity[]> {
    return await this.classSessionRepository.find({ relations: ['course'] }); // Lấy thông tin khóa học liên quan
  }

  async findOne(id: number): Promise<ClassSessionEntity> {
    const classSession = await this.classSessionRepository.findOne({
      where: { id },
      relations: ['course'],
    });
    if (!classSession) {
      throw new NotFoundException(`Không tìm thấy buổi học có ID ${id}`);
    }
    return classSession;
  }

  async update(
    id: number,
    updateClassSessionDto: UpdateClassSessionDto,
  ): Promise<ClassSessionEntity> {
    const classSession = await this.findOne(id);
    this.classSessionRepository.merge(classSession, updateClassSessionDto);
    return await this.classSessionRepository.save(classSession);
  }

  async remove(id: number): Promise<void> {
    const result = await this.classSessionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy buổi học có ID ${id}`);
    }
  }
}
