import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity) private repo: Repository<RoleEntity>,
  ) {}
  create(dto: CreateRoleDto) {
    return this.repo.save(this.repo.create(dto));
  }
  findAll() {
    return this.repo.find();
  }
  async findOne(id: number) {
    const role = await this.repo.findOneBy({ id });
    if (!role) throw new NotFoundException('Vai trò không tồn tại.');
    return role;
  }
  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    this.repo.merge(role, dto);
    return this.repo.save(role);
  }
  async remove(id: number) {
    const result = await this.repo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Vai trò không tồn tại.');
  }
}
