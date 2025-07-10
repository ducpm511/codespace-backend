// src/modules/student-report/student-report.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { StudentReportService } from './student-report.service';
import { CreateStudentReportDto } from './dto/create-student-report.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/common/cloudinary.service';

@Controller('student-reports')
export class StudentReportController {
  constructor(
    private readonly reportService: StudentReportService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  create(@Body() dto: CreateStudentReportDto) {
    console.log('DTO received:', dto);
    return this.reportService.create(dto);
  }

  @Get('student/:studentId')
  getByStudent(@Param('studentId') studentId: string) {
    return this.reportService.findByStudent(+studentId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportService.remove(+id);
  }

  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const uploaded = (await this.cloudinaryService.uploadPdf(file)) as {
      secure_url: string;
    };
    return { secure_url: uploaded.secure_url };
  }

  @Get()
  getAllWithFilters(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('classId') classId?: string,
  ) {
    return this.reportService.findAllWithFilters({
      page: Number(page),
      limit: Number(limit),
      search,
      classId: classId ? Number(classId) : undefined,
    });
  }

  @Get('/public/:accessToken')
  getPublicReport(@Param('accessToken') accessToken: string) {
    return this.reportService.getByAccessToken(accessToken);
  }
}
