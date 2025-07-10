import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from 'src/entities/course.entity';

@Module({
  providers: [CourseService],
  controllers: [CourseController],
  imports: [TypeOrmModule.forFeature([CourseEntity])]
})
export class CourseModule {}
