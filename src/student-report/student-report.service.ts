// src/student-report/student-report.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentReportEntity } from 'src/entities/student-report.entity';
import { CreateStudentReportDto } from './dto/create-student-report.dto';
import { StudentEntity } from 'src/entities/student.entity';
import { ClassEntity } from 'src/entities/class.entity';
import {
  ReportLinkEntity,
  ReportLinkType,
} from 'src/entities/report-link.entity';
import { ReportFileEntity } from 'src/entities/report-file.entity';

@Injectable()
export class StudentReportService {
  constructor(
    @InjectRepository(StudentReportEntity)
    private readonly reportRepo: Repository<StudentReportEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ReportLinkEntity)
    private readonly reportLinkRepo: Repository<ReportLinkEntity>,
    @InjectRepository(ReportFileEntity)
    private readonly reportFileRepo: Repository<ReportFileEntity>,
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
      .leftJoinAndSelect('report.files', 'files')
      .leftJoinAndSelect('report.links', 'links')
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

  async update(id: number, dto: Partial<CreateStudentReportDto>) {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['student', 'class', 'files', 'links'],
    });
    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }

    if (dto.studentId) {
      const student = await this.studentRepo.findOne({
        where: { id: dto.studentId },
      });
      if (!student) throw new NotFoundException('Student không tồn tại');
      report.student = student;
    }

    if (dto.classId) {
      const classData = await this.classRepo.findOne({
        where: { id: dto.classId },
      });
      if (!classData) throw new NotFoundException('Class không tồn tại');
      report.class = classData;
    }

    if (dto.pdfFiles) {
      await this.reportFileRepo.delete({ report: { id } });

      report.files = dto.pdfFiles.map((file) =>
        this.reportRepo.manager.create('ReportFileEntity', {
          fileName: this.extractFileName(file.fileUrl),
          fileUrl: file.fileUrl,
          testType: file.testType,
          score: file.score,
          report: report,
        }),
      );
    }

    if (dto.youtubeLinks || dto.scratchProjects) {
      await this.reportLinkRepo.delete({ report: { id } });

      const links = [
        ...(dto.youtubeLinks?.map((url) =>
          this.reportRepo.manager.create(ReportLinkEntity, {
            type: ReportLinkType.YOUTUBE,
            urlOrEmbedCode: url,
            report: report,
          }),
        ) || []),
        ...(dto.scratchProjects?.map((project) =>
          this.reportRepo.manager.create(ReportLinkEntity, {
            type: ReportLinkType.SCRATCH_EMBED,
            urlOrEmbedCode: project.embedCode,
            projectName: project.projectName,
            description: project.description,
            report: report,
          }),
        ) || []),
      ];
      report.links = links;
    }

    return await this.reportRepo.save(report);
  }

  private extractFileName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'unknown.pdf';
  }
}
