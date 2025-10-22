import { Controller, Get, Query } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollReportDto } from './dto/payroll-report.dto';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('report')
  generateReport(@Query() query: PayrollReportDto) {
    return this.payrollService.generateReport(query);
  }
}
