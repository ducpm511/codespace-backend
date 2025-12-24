import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  ParseIntPipe,
  UseGuards, // Để bảo vệ endpoint, chỉ cho phép admin/quản lý truy cập
  Req,
  UnauthorizedException, // Để lấy thông tin người dùng đang đăng nhập
} from '@nestjs/common';
import { OtRequestsService } from './ot-requests.service';
import { UpdateOtRequestDto } from './dto/update-ot-request.dto';
import { OtRequestStatus } from '../entities/ot-request.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Ví dụ Guard xác thực
// import { RolesGuard } from '../auth/guards/roles.guard'; // Ví dụ Guard phân quyền
// import { Roles } from '../auth/decorators/roles.decorator'; // Ví dụ Decorator phân quyền

@Controller('ot-requests')
@UseGuards(JwtAuthGuard, RolesGuard) // Áp dụng bảo vệ cho toàn bộ controller
export class OtRequestsController {
  constructor(private readonly otRequestsService: OtRequestsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN) // Chỉ admin/manager mới được xem
  findAll(
    @Query('status') status?: OtRequestStatus,
    @Query('staffId') staffId?: number,
  ) {
    const parsedStaffId = staffId
      ? parseInt(staffId.toString(), 10)
      : undefined;
    return this.otRequestsService.findAll(status, parsedStaffId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.otRequestsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOtRequestDto,
    @Req() req: any, // Sử dụng @Req() để lấy request object
  ) {
    // Giả sử thông tin user được lưu trong req.user sau khi xác thực
    const approverUser = req.user;
    if (!approverUser) {
      throw new UnauthorizedException('Không tìm thấy thông tin người duyệt.');
    }
    return this.otRequestsService.updateStatus(id, dto, approverUser);
  }
}
