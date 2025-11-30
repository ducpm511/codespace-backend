import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollReportDto } from './dto/payroll-report.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard) // Protect all routes with JwtAuthGuard
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('report')
  generateReport(@Query() query: PayrollReportDto) {
    return this.payrollService.generateReport(query);
  }
}
