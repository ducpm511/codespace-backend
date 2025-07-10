// src/parent/parent.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentService } from './parent.service';
import { ParentController } from './parent.controller';
import { ParentEntity } from '../entities/parent.entity';
import { StudentEntity } from '../entities/student.entity'; // Đảm bảo bạn import StudentEntity nếu ParentService sử dụng nó

@Module({
  imports: [TypeOrmModule.forFeature([ParentEntity, StudentEntity])], // Hoặc các Entity khác mà ParentService cần
  controllers: [ParentController],
  providers: [ParentService],
  exports: [ParentService], //
})
export class ParentModule {}
