import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from 'src/auth/enums/role.enum';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create({
      ...createUserDto,
      role: createUserDto.role ?? Role.USER,
    });
    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepo.find({
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'avatarUrl',
        'role',
        'createdAt',
      ],
      order: {
        id: 'DESC',
      },
    });
  }

  async findAllWithFilter(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
  }): Promise<{
    data: User[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { page = 1, limit = 10, search = '', role } = query;

    const qb = this.userRepo.createQueryBuilder('user');

    if (search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    qb.select([
      'user.id',
      'user.firstName',
      'user.lastName',
      'user.email',
      'user.avatarUrl',
      'user.role',
      'user.createdAt',
    ])
      .orderBy('user.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'avatarUrl',
        'role',
        'hashedRefreshToken',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepo.findOne({
      where: { email },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    Object.assign(user, updateUserDto);
    return await this.userRepo.save(user);
  }

  async updateHashedRefreshToken(userId: number, hashedRefreshToken: string) {
    await this.userRepo.update({ id: userId }, { hashedRefreshToken });
  }

  async remove(id: number): Promise<{ message: string }> {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { message: `User with ID ${id} has been removed.` };
  }
}
