// src/student-report/student-report.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentReportEntity } from 'src/entities/student-report.entity';
import { CreateStudentReportDto } from './dto/create-student-report.dto';
import { StudentEntity } from 'src/entities/student.entity';
import { ClassEntity } from 'src/entities/class.entity';
import { ReportLinkType } from 'src/entities/report-link.entity';

@Injectable()
export class StudentReportService {
  constructor(
    @InjectRepository(StudentReportEntity)
    private readonly reportRepo: Repository<StudentReportEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
  ) {}

  async create(dto: CreateStudentReportDto) {
    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    const classData = await this.classRepo.findOne({
      where: { id: dto.classId },
    });

    if (!student || !classData) {
      throw new NotFoundException('Student hoặc Class không tồn tại');
    }

    const report = this.reportRepo.create({
      title: `Báo cáo học tập ${student.fullName} - ${classData.className}`,
      student,
      class: classData,
      files:
        dto.pdfFiles?.map((file) => ({
          fileName: this.extractFileName(file.fileUrl),
          fileUrl: file.fileUrl,
          testType: file.testType,
          score: file.score,
        })) || [],
      links: [
        ...(dto.youtubeLinks?.map((url) => ({
          type: ReportLinkType.YOUTUBE,
          urlOrEmbedCode: url,
        })) || []),
        ...(dto.scratchProjects?.map((project) => ({
          type: ReportLinkType.SCRATCH_EMBED,
          urlOrEmbedCode: project.embedCode,
          projectName: project.projectName,
          description: project.description,
        })) || []),
      ],
    });

    return await this.reportRepo.save(report);
  }

  async findByStudent(studentId: number) {
    return this.reportRepo.find({
      where: { student: { id: studentId } },
      relations: ['student', 'class', 'files', 'links'],
      order: { createdAt: 'DESC' },
    });
  }

  async getByAccessToken(accessToken: string) {
    const report = await this.reportRepo.findOne({
      where: { accessToken },
      relations: ['student', 'class', 'files', 'links'],
    });

    if (!report) {
      throw new NotFoundException(
        'Không tìm thấy báo cáo với accessToken đã cho',
      );
    }

    return report;
  }

  async findAllWithFilters(query: {
    page?: number;
    limit?: number;
    search?: string;
    classId?: number;
  }) {
    const { page = 1, limit = 10, search = '', classId } = query;
    const qb = this.reportRepo
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.student', 'student')
      .leftJoinAndSelect('report.class', 'class')
      .addSelect('report.accessToken');

    if (search) {
      qb.andWhere('student.fullName ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (classId) {
      qb.andWhere('class.id = :classId', { classId });
    }

    qb.orderBy('report.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async remove(id: number) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }
    return this.reportRepo.remove(report);
  }

  private extractFileName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'unknown.pdf';
  }
}
