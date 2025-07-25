import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PropertyModule } from './property/property.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './student/student.module';
import { ParentModule } from './parent/parent.module';
import { CourseModule } from './course/course.module';
import dbConfig from './config/db.config';
import dbConfigProduction from './config/db.config.production';
// import { StudentEntity } from './entities/student.entity';
// import { ParentEntity } from './entities/parent.entity';
// import { CourseEntity } from './entities/course.entity';
import { StaffModule } from './staff/staff.module';
import { ClassSessionModule } from './class-session/class-session.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClassModule } from './class/class.module';
import { ScheduleModule } from '@nestjs/schedule';
import { StudentReportModule } from './student-report/student-report.module';
import { HolidayEntity } from './entities/holidays.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [dbConfig, dbConfigProduction],
    }),
    PropertyModule,
    TypeOrmModule.forRootAsync({
      useFactory:
        process.env.NODE_ENV === 'production' ? dbConfigProduction : dbConfig,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([HolidayEntity]),
    UserModule,
    AuthModule,
    StudentsModule,
    ParentModule,
    CourseModule,
    StaffModule,
    ClassSessionModule,
    AttendanceModule,
    ClassModule,
    StudentReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
