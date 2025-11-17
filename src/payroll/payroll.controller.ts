import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollReportDto } from './dto/payroll-report.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';

@Controller('payroll')
@UseGuards(JwtAuthGuard) // Protect all routes with JwtAuthGuard
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('report')
  generateReport(@Query() query: PayrollReportDto) {
    return this.payrollService.generateReport(query);
  }
}
