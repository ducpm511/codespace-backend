import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  UsePipes, // Import ValidationPipe
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto'; // <-- Import UpdateClassDto mới
import { ClassEntity } from '../entities/class.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard'; // Import RolesGuard
import { Roles } from 'src/auth/decorators/roles.decorator'; // Import Roles decorator
import { Role } from 'src/auth/enums/role.enum'; // Import Role enum

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard) // Áp dụng cho toàn bộ controller
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) // Ví dụ: Chỉ Admin và Super Admin được tạo lớp
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true })) // Thêm ValidationPipe
  async create(@Body() createClassDto: CreateClassDto): Promise<ClassEntity> {
    return await this.classesService.create(createClassDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER) // Ví dụ: Tất cả đều được xem
  async findAll(): Promise<ClassEntity[]> {
    return await this.classesService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ClassEntity> {
    return await this.classesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) // Ví dụ: Chỉ Admin và Super Admin được cập nhật
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true })) // Thêm ValidationPipe
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClassDto: UpdateClassDto, // <-- Sử dụng UpdateClassDto mới
  ): Promise<ClassEntity> {
    return await this.classesService.update(id, updateClassDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN) // Ví dụ: Chỉ Super Admin được xóa
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.classesService.remove(id);
  }
}
