// src/students/students.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './student.service';
import { StudentsController } from './student.controller';
import { StudentEntity } from '../entities/student.entity';
import { ClassEntity } from '../entities/class.entity'; // Import ClassEntity
import { ParentEntity } from '../entities/parent.entity'; // Import ParentEntity

@Module({
  imports: [
    // Đảm bảo Student, Class, và Parent Entities đều được forFeature
    TypeOrmModule.forFeature([StudentEntity, ClassEntity, ParentEntity]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService], // Export StudentsService nếu các module khác cần
})
export class StudentsModule {}
