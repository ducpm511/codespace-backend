// src/students/students.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentEntity } from '../entities/student.entity';
import { ClassEntity } from '../entities/class.entity';
import { ParentEntity } from '../entities/parent.entity'; // Import ParentEntity
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStudentWithParentDto } from './dto/create-student-with-parent.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentEntity)
    private studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ClassEntity)
    private classRepository: Repository<ClassEntity>,
    @InjectRepository(ParentEntity) // Inject ParentEntity repository
    private parentRepository: Repository<ParentEntity>,
  ) {}

  async create(createStudentDto: CreateStudentDto): Promise<StudentEntity> {
    const { classIds, parentId, newParent, ...studentCoreData } =
      createStudentDto;

    // 1. Xử lý Phụ huynh
    let parentToAssign: ParentEntity | null = null;
    if (newParent) {
      // Tạo phụ huynh mới
      const createdParent = this.parentRepository.create(newParent);
      parentToAssign = await this.parentRepository.save(createdParent);
    } else if (parentId) {
      // Gán phụ huynh hiện có
      parentToAssign = await this.parentRepository.findOneBy({ id: parentId });
      if (!parentToAssign) {
        throw new NotFoundException(`Parent with ID ${parentId} not found.`);
      }
    }

    // 2. Tạo đối tượng Student
    const newStudent = this.studentsRepository.create({
      ...studentCoreData,
      parent: parentToAssign, // Gán đối tượng phụ huynh
      parentId: parentToAssign ? parentToAssign.id : null,
    });

    // 3. Xử lý mối quan hệ ManyToMany với Class
    if (classIds && classIds.length > 0) {
      const classes = await this.classRepository.findByIds(classIds);
      if (classes.length !== classIds.length) {
        throw new BadRequestException(
          'One or more class IDs provided are invalid.',
        );
      }
      newStudent.classes = classes; // Gán mảng các đối tượng Class
    } else {
      newStudent.classes = []; // Đảm bảo là mảng rỗng nếu không có lớp nào được chọn
    }

    const savedStudent = await this.studentsRepository.save(newStudent);
    return savedStudent;
  }

  async createWithParent(
    createStudentDto: CreateStudentWithParentDto,
  ): Promise<StudentEntity> {
    // Tạo phụ huynh mới từ createStudentDto.newParent
    const createdParent = this.parentRepository.create(
      createStudentDto.newParent,
    );
    const savedParent = await this.parentRepository.save(createdParent);

    // Tạo student với parent vừa tạo
    const { classIds, ...studentCoreData } = createStudentDto;
    const newStudent = this.studentsRepository.create({
      ...studentCoreData,
      parent: savedParent,
      parentId: savedParent.id,
    });

    // Xử lý mối quan hệ ManyToMany với Class
    if (classIds && classIds.length > 0) {
      const classes = await this.classRepository.findByIds(classIds);
      if (classes.length !== classIds.length) {
        throw new BadRequestException(
          'One or more class IDs provided are invalid.',
        );
      }
      newStudent.classes = classes;
    } else {
      newStudent.classes = [];
    }

    return await this.studentsRepository.save(newStudent);
  }

  async findAll(): Promise<StudentEntity[]> {
    // Thêm 'classes' và 'parent' vào relations để lấy thông tin liên quan
    return await this.studentsRepository.find({
      relations: ['classes', 'parent'],
    });
  }

  async findOne(id: number): Promise<StudentEntity> {
    const studentFound = await this.studentsRepository.findOne({
      where: { id },
      relations: ['classes', 'parent'], // Load classes and parent
    });
    if (!studentFound) {
      throw new NotFoundException(`Student with ID ${id} not found.`);
    }
    return studentFound;
  }

  async update(
    id: number,
    updateStudentDto: UpdateStudentDto,
  ): Promise<StudentEntity> {
    const studentToUpdate = await this.studentsRepository.findOne({
      where: { id },
      relations: ['classes', 'parent'], // Quan trọng: Load các mối quan hệ hiện có
    });
    if (!studentToUpdate) {
      throw new NotFoundException(`Student with ID ${id} not found.`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { classIds, parentId, newParent, ...studentCoreData } =
      updateStudentDto;

    // 1. Cập nhật các trường core của Student
    this.studentsRepository.merge(studentToUpdate, studentCoreData);

    // 2. Xử lý Phụ huynh (chỉ cập nhật parentId, không tạo mới trong update)
    if (parentId !== undefined) {
      // Check if parentId is explicitly provided (can be null)
      if (parentId === null) {
        studentToUpdate.parent = null;
        studentToUpdate.parentId = null;
      } else {
        const parentToAssign = await this.parentRepository.findOneBy({
          id: parentId,
        });
        if (!parentToAssign) {
          throw new NotFoundException(`Parent with ID ${parentId} not found.`);
        }
        studentToUpdate.parent = parentToAssign;
        studentToUpdate.parentId = parentToAssign.id;
      }
    }
    // newParent không được xử lý trong update (chỉ create)

    // 3. Cập nhật mối quan hệ ManyToMany với Class
    if (classIds !== undefined) {
      // Nếu classIds được cung cấp trong DTO
      if (classIds.length > 0) {
        const classes = await this.classRepository.findByIds(classIds);
        if (classes.length !== classIds.length) {
          throw new BadRequestException(
            'One or more class IDs provided are invalid.',
          );
        }
        studentToUpdate.classes = classes; // Gán lại toàn bộ mảng lớp học
      } else {
        studentToUpdate.classes = []; // Nếu mảng rỗng, gỡ bỏ tất cả các lớp đã gán
      }
    }
    // Lưu ý: TypeORM tự động quản lý bảng join khi bạn gán mảng quan hệ và gọi save()

    const updatedStudent = await this.studentsRepository.save(studentToUpdate);
    return updatedStudent;
  }

  async remove(id: number): Promise<void> {
    const result = await this.studentsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Student with ID ${id} not found.`);
    }
  }
}
