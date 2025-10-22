import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  OtRequestEntity,
  OtRequestStatus,
} from '../entities/ot-request.entity';
import { UpdateOtRequestDto } from './dto/update-ot-request.dto';
import { StaffEntity } from '../entities/staff.entity'; // Để lấy thông tin người duyệt

@Injectable()
export class OtRequestsService {
  constructor(
    @InjectRepository(OtRequestEntity)
    private readonly otRequestRepo: Repository<OtRequestEntity>,
  ) {}

  async findAll(status?: OtRequestStatus): Promise<OtRequestEntity[]> {
    const where: FindOptionsWhere<OtRequestEntity> = {};
    if (status) {
      where.status = status;
    }
    // Lấy kèm thông tin nhân viên để hiển thị
    return this.otRequestRepo.find({ where, relations: ['staff'] });
  }

  async findOne(id: number): Promise<OtRequestEntity> {
    const request = await this.otRequestRepo.findOne({
      where: { id },
      relations: ['staff', 'approver'], // Lấy cả người duyệt nếu có
    });
    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu OT với ID ${id}`);
    }
    return request;
  }

  async updateStatus(
    id: number,
    dto: UpdateOtRequestDto,
    approverUser: StaffEntity, // Thông tin người dùng đang thực hiện (lấy từ request)
  ): Promise<OtRequestEntity> {
    const otRequest = await this.findOne(id);

    // Chỉ cho phép cập nhật nếu đang ở trạng thái pending
    if (otRequest.status !== OtRequestStatus.PENDING) {
      throw new BadRequestException(`Yêu cầu OT này đã được xử lý.`);
    }

    otRequest.status = dto.status;
    otRequest.notes = dto.notes;
    otRequest.approver = approverUser; // Gán người duyệt
    otRequest.approverId = approverUser.id;

    // Nếu duyệt, mặc định approvedDuration bằng detectedDuration
    // (Có thể thêm logic để nhận approvedDuration từ DTO nếu muốn)
    if (dto.status === OtRequestStatus.APPROVED) {
      otRequest.approvedDuration = otRequest.detectedDuration;
    } else {
      otRequest.approvedDuration = null; // Nếu từ chối thì không có giờ duyệt
    }

    return this.otRequestRepo.save(otRequest);
  }
}
