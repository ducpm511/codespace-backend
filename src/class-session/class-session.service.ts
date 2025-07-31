import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSessionEntity } from '../entities/class-session.entity';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { DateTime } from 'luxon'; // Import Luxon for date handling

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
  // Thêm phương thức để lấy lịch học từ buổi học
  async getScheduleFromSession(classId: number): Promise<any> {
    const classSessions = await this.classSessionRepository.find({
      where: { class: { id: classId } },
      relations: ['class'],
      take: 2, // Giới hạn số lượng buổi học trả về
    });
    if (!classSessions || classSessions.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy buổi học cho lớp ID ${classId}`,
      );
    }
    const schedule = classSessions.map((session) => {
      const time = session.startTime;
      const sessionDate = session.sessionDate;
      const formatedDate = DateTime.fromJSDate(new Date(sessionDate));
      const day = formatedDate.toFormat('cccc').trim();
      return { day, time };
    });
    return schedule ? schedule : [];
  }
}
