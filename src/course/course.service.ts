import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity } from '../entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async create(createCourseDto: CreateCourseDto): Promise<CourseEntity> {
    const course = this.courseRepository.create(createCourseDto);
    return await this.courseRepository.save(course);
  }

  async findAll(): Promise<CourseEntity[]> {
    return await this.courseRepository.find();
  }

  async findOne(id: number): Promise<CourseEntity> {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Không tìm thấy khóa học có ID ${id}`);
    }
    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto): Promise<CourseEntity> {
    const course = await this.findOne(id);
    this.courseRepository.merge(course, updateCourseDto);
    return await this.courseRepository.save(course);
  }

  async remove(id: number): Promise<void> {
    const result = await this.courseRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy khóa học có ID ${id}`);
    }
  }
}