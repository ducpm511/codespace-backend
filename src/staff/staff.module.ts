import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffEntity } from 'src/entities/staff.entity';

@Module({
  providers: [StaffService],
  controllers: [StaffController],
  imports: [TypeOrmModule.forFeature([StaffEntity])],
})
export class StaffModule {}
