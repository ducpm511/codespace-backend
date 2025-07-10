// src/classes/classes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AttendanceService } from '../attendance/attendance.service'; // <-- Import AttendanceService

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassEntity)
    private classesRepository: Repository<ClassEntity>,
    private readonly attendanceService: AttendanceService, // <-- Inject AttendanceService
  ) {}

  async create(createClassDto: CreateClassDto): Promise<ClassEntity> {
    const newClass = this.classesRepository.create(createClassDto);
    const savedClass = await this.classesRepository.save(newClass);

    // Nếu có thông tin lịch học đầy đủ và hợp lệ, tạo các buổi học
    if (
      savedClass.startDate !== null && // Đảm bảo không phải null
      savedClass.totalSessions !== null &&
      savedClass.totalSessions > 0 && // Đảm bảo không phải null và là số dương
      savedClass.scheduleDays !== null &&
      savedClass.scheduleDays.length > 0 && // Đảm bảo không phải null và không rỗng
      savedClass.scheduleTime !== null // Đảm bảo không phải null
    ) {
      await this.attendanceService.generateClassSessions(savedClass.id);
    }
    return savedClass;
  }

  async findAll(): Promise<ClassEntity[]> {
    // Để lấy đủ thông tin lịch học, không cần quan hệ đặc biệt ở đây
    return await this.classesRepository.find();
  }

  async findOne(id: number): Promise<ClassEntity> {
    const classFound = await this.classesRepository.findOneBy({ id });
    if (!classFound) {
      throw new NotFoundException(`Class with ID ${id} not found.`);
    }
    return classFound;
  }

  async update(
    id: number,
    updateClassDto: UpdateClassDto,
  ): Promise<ClassEntity> {
    const classToUpdate = await this.classesRepository.findOneBy({ id });
    if (!classToUpdate) {
      throw new NotFoundException(`Class with ID ${id} not found.`);
    }

    // Merge các thuộc tính từ updateClassDto vào classToUpdate
    this.classesRepository.merge(classToUpdate, updateClassDto);

    const updatedClass = await this.classesRepository.save(classToUpdate);

    // Nếu có thông tin lịch học mới hoặc cập nhật đầy đủ và hợp lệ, tạo/cập nhật các buổi học
    if (
      updatedClass.startDate !== null && // Đảm bảo không phải null
      updatedClass.totalSessions !== null &&
      updatedClass.totalSessions > 0 && // Đảm bảo không phải null và là số dương
      updatedClass.scheduleDays !== null &&
      updatedClass.scheduleDays.length > 0 && // Đảm bảo không phải null và không rỗng
      updatedClass.scheduleTime !== null // Đảm bảo không phải null
    ) {
      await this.attendanceService.generateClassSessions(updatedClass.id);
    }
    return updatedClass;
  }

  async remove(id: number): Promise<void> {
    const result = await this.classesRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Class with ID ${id} not found.`);
    }
  }
}
