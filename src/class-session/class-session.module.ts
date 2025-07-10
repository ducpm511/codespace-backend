import { Module } from '@nestjs/common';
import { ClassSessionService } from './class-session.service';
import { ClassSessionController } from './class-session.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSessionEntity } from 'src/entities/class-session.entity';

@Module({
  providers: [ClassSessionService],
  controllers: [ClassSessionController],
  imports: [TypeOrmModule.forFeature([ClassSessionEntity])]
})
export class ClassSessionModule {}
