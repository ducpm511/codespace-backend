import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Raw } from 'typeorm';
import { DateTime, Interval, Duration } from 'luxon';
import {
  StaffAttendanceEntity,
  AttendanceType,
} from '../entities/staff-attendance.entity';
import { StaffScheduleEntity } from '../entities/staff-schedule.entity';
import { StaffEntity } from '../entities/staff.entity';
import {
  OtRequestEntity,
  OtRequestStatus,
} from '../entities/ot-request.entity';
import { ShiftEntity } from '../entities/shift.entity';
import { ClassSessionEntity } from '../entities/class-session.entity';

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'; // Define standard timezone

// Define role priorities
const ROLE_PRIORITY: Record<string, number> = {
  teacher: 3,
  'teaching-assistant': 2, // Ensure this key matches your RoleEntity key
  'part-time': 1,
};

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);
  constructor(
    @InjectRepository(StaffAttendanceEntity)
    private readonly attendanceRepo: Repository<StaffAttendanceEntity>,
    @InjectRepository(StaffScheduleEntity)
    private readonly scheduleRepo: Repository<StaffScheduleEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    @InjectRepository(OtRequestEntity)
    private readonly otRequestRepo: Repository<OtRequestEntity>,
    @InjectRepository(ShiftEntity)
    private readonly shiftRepo: Repository<ShiftEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionRepo: Repository<ClassSessionEntity>,
  ) {}

  async generateReport(query: {
    fromDate: string;
    toDate: string;
    staffId?: string;
  }) {
    const { fromDate, toDate, staffId } = query;
    console.log('--- BẮT ĐẦU TẠO BÁO CÁO ---');
    console.log('1. Dữ liệu đầu vào:', { fromDate, toDate, staffId });

    // --- (Phần truy vấn dữ liệu không thay đổi) ---
    const scheduleWhereCondition = {
      date: Between(fromDate, toDate),
      ...(staffId && { staffId: parseInt(staffId, 10) }),
    };
    const attendanceWhereCondition = {
      timestamp: Raw(
        (alias) => `${alias} >= :fromDate AND ${alias} < :toDate`,
        {
          fromDate: fromDate,
          toDate: DateTime.fromISO(toDate).plus({ days: 1 }).toISODate(),
        },
      ),
      ...(staffId && { staffId: parseInt(staffId, 10) }),
    };
    const approvedOtWhereCondition = {
      date: Between(fromDate, toDate),
      status: OtRequestStatus.APPROVED,
      ...(staffId && { staffId: parseInt(staffId, 10) }),
    };

    try {
      const [attendances, schedules, staffList, approvedOtRequests] =
        await Promise.all([
          this.attendanceRepo.find({
            where: attendanceWhereCondition,
            order: { timestamp: 'ASC' },
          }),
          this.scheduleRepo.find({
            where: scheduleWhereCondition,
            relations: ['shift', 'classSession', 'classSession.class', 'staff'],
          }),
          this.staffRepo.find({
            where: staffId ? { id: parseInt(staffId, 10) } : {},
          }),
          this.otRequestRepo.find({ where: approvedOtWhereCondition }),
        ]);

      // ... (console.log và kiểm tra dữ liệu rỗng không đổi) ...

      const staffDataMap = new Map<
        number,
        {
          attendances: StaffAttendanceEntity[];
          schedules: StaffScheduleEntity[];
        }
      >();
      for (const staff of staffList) {
        staffDataMap.set(staff.id, { attendances: [], schedules: [] });
      }
      attendances.forEach((a) => {
        if (staffDataMap.has(a.staffId)) {
          staffDataMap.get(a.staffId)?.attendances.push(a);
        }
      });
      schedules.forEach((s) => {
        if (s.staffId && staffDataMap.has(s.staffId)) {
          staffDataMap.get(s.staffId)?.schedules.push(s);
        }
      });
      const approvedOtMap = new Map<string, OtRequestEntity>();
      approvedOtRequests.forEach((ot) => {
        approvedOtMap.set(`${ot.staffId}-${ot.date}`, ot);
      });

      console.log('4. Dữ liệu đã được gom nhóm.');
      const report = [];

      for (const staff of staffList) {
        // ... (kiểm tra bỏ qua staff không đổi) ...

        let totalPay = 0;
        const dailyBreakdown = [];
        const staffData = staffDataMap.get(staff.id);

        console.log(`5. Bắt đầu xử lý cho nhân viên: ${staff.fullName}`);
        const attendancesByDate = this.groupAttendancesByDate(
          staffData?.attendances || [],
        );

        for (const [date, dailyAttendances] of Object.entries(
          attendancesByDate,
        )) {
          console.log(`\n--- Ngày ${date} ---`);
          const firstCheckIn = dailyAttendances.find(
            (a) => a.type === AttendanceType.CHECK_IN,
          );
          const lastCheckOut = [...dailyAttendances]
            .reverse()
            .find((a) => a.type === AttendanceType.CHECK_OUT);

          let dailyStandardPay = 0;
          let potentialOtMinutes = 0;
          let finalWorkBlocks: {
            type: string | undefined;
            duration: number;
            pay: number;
          }[] = [];

          if (firstCheckIn && lastCheckOut) {
            const checkInDt = DateTime.fromJSDate(
              firstCheckIn.timestamp,
            ).setZone(VN_TIMEZONE);
            const checkOutDt = DateTime.fromJSDate(
              lastCheckOut.timestamp,
            ).setZone(VN_TIMEZONE);

            if (checkOutDt <= checkInDt) {
              /* ... (bỏ qua ngày lỗi) ... */ continue;
            }

            const totalActualWorkInterval = Interval.fromDateTimes(
              checkInDt,
              checkOutDt,
            );

            // --- BƯỚC 1: TRỪ GIỜ NGHỈ TRƯA ---
            const lunchStart = DateTime.fromISO(`${date}T11:45:00`, {
              zone: VN_TIMEZONE,
            });
            const lunchEnd = DateTime.fromISO(`${date}T13:15:00`, {
              zone: VN_TIMEZONE,
            });
            const lunchInterval = Interval.fromDateTimes(lunchStart, lunchEnd);
            const payableWorkIntervals =
              totalActualWorkInterval.difference(lunchInterval);

            let totalPayableDuration = Duration.fromMillis(0);
            payableWorkIntervals.forEach((interval) => {
              totalPayableDuration = totalPayableDuration.plus(
                interval.toDuration(),
              );
            });

            console.log(
              ` -> CheckIn: ${checkInDt.toFormat('HH:mm:ss')}, CheckOut: ${checkOutDt.toFormat('HH:mm:ss')}, Tổng Thực tế: ${totalActualWorkInterval.toDuration().toFormat('hh:mm:ss')}`,
            );
            console.log(
              ` -> Nghỉ trưa (nếu có): ${totalActualWorkInterval.intersection(lunchInterval)?.toDuration().toFormat('hh:mm:ss') || '00:00:00'}`,
            );
            console.log(
              ` -> Thời gian thực tính (đã trừ nghỉ trưa): ${totalPayableDuration.toFormat('hh:mm:ss')}`,
            );

            const dailySchedules =
              staffData?.schedules.filter((s) => s.date === date) || [];
            let totalScheduledDuration = Duration.fromMillis(0);
            console.log(
              ` -> Số lịch trình trong ngày: ${dailySchedules.length}`,
            );

            const potentialIntersections: {
              interval: Interval;
              rateType: string | undefined;
              priority: number;
            }[] = [];

            if (dailySchedules.length > 0) {
              for (const schedule of dailySchedules) {
                let scheduleInterval: Interval | null = null;
                let rateType: string | undefined;
                let priority = 0;

                if (schedule.classSession) {
                  const actualStart = DateTime.fromISO(
                    `${schedule.date}T${schedule.classSession.startTime}`,
                    { zone: VN_TIMEZONE },
                  );
                  const paidStart = actualStart.minus({ minutes: 15 });
                  const paidEnd = actualStart.plus({ minutes: 90 + 15 });
                  scheduleInterval = Interval.fromDateTimes(paidStart, paidEnd);
                  rateType = schedule.roleKey || undefined;
                  priority = ROLE_PRIORITY[rateType || ''] || 0;
                  console.log(
                    `    -> Lịch dạy (${rateType}): ${scheduleInterval?.start?.toFormat('HH:mm')} - ${scheduleInterval?.end?.toFormat('HH:mm')}`,
                  );
                } else if (schedule.shift) {
                  const start = DateTime.fromISO(
                    `${schedule.date}T${schedule.shift.startTime}`,
                    { zone: VN_TIMEZONE },
                  );
                  const end = DateTime.fromISO(
                    `${schedule.date}T${schedule.shift.endTime}`,
                    { zone: VN_TIMEZONE },
                  );
                  if (end > start) {
                    scheduleInterval = Interval.fromDateTimes(start, end);
                    rateType = 'part-time';
                    priority = ROLE_PRIORITY[rateType] || 0;
                    console.log(
                      `    -> Lịch ca (${rateType}): ${scheduleInterval?.start?.toFormat('HH:mm')} - ${scheduleInterval?.end?.toFormat('HH:mm')}`,
                    );
                  } else {
                    console.warn(
                      ` -> Lịch ca không hợp lệ (giờ kết thúc trước giờ bắt đầu) cho schedule ID ${schedule.id}`,
                    );
                  }
                }

                if (scheduleInterval) {
                  totalScheduledDuration = totalScheduledDuration.plus(
                    scheduleInterval.toDuration(),
                  );

                  payableWorkIntervals.forEach((payableInterval) => {
                    const intersection =
                      payableInterval.intersection(scheduleInterval);
                    if (intersection && intersection.isValid) {
                      const durationMins = intersection
                        .toDuration()
                        .as('minutes');
                      console.log(
                        `    -> Giao với lịch (${rateType}): ${intersection.start?.toFormat('HH:mm')} - ${intersection.end?.toFormat('HH:mm')} (${durationMins} phút)`,
                      );
                      potentialIntersections.push({
                        interval: intersection,
                        rateType,
                        priority,
                      });
                    }
                  });
                }
              } // End schedule loop

              finalWorkBlocks = this.resolveOverlappingBlocks(
                potentialIntersections,
                staff.rates || {},
              );
              console.log(
                ' -> Các khối giờ chuẩn (đã xử lý ưu tiên):',
                finalWorkBlocks.map((b) => ({
                  type: b.type,
                  duration: b.duration,
                })),
              );

              // --- XÓA BỎ LOGIC TÍNH PART-TIME CÒN LẠI ---
              /*
                 let calculatedStandardDuration = Duration.fromMillis(0);
                 finalWorkBlocks.forEach((block) => {
                   calculatedStandardDuration = calculatedStandardDuration.plus({ minutes: block.duration });
                 });
                 const remainingDuration = totalPayableDuration.minus(calculatedStandardDuration);
                 if (remainingDuration.as('minutes') > 1 && staff.rates && staff.rates['part-time']) {
                   // ...
                   finalWorkBlocks.push({ type: 'part-time', ... });
                 }
                 */
              // --- KẾT THÚC XÓA BỎ ---

              // --- TÍNH OT TIỀM NĂNG (Thực tính - Lịch) ---
              let potentialOtDuration = totalPayableDuration.minus(
                totalScheduledDuration,
              );
              if (potentialOtDuration.as('minutes') < 0) {
                potentialOtDuration = Duration.fromMillis(0);
              }
              console.log(
                ` -> Tổng giờ theo lịch (đã cộng 30p dạy): ${totalScheduledDuration.toFormat('hh:mm:ss')}`,
              );
              console.log(
                ` -> Giờ OT tiềm năng (Thực tính - Lịch): ${potentialOtDuration.toFormat('hh:mm:ss')}`,
              );

              const otMinutesDetected = potentialOtDuration.as('minutes');
              if (otMinutesDetected > 1) {
                this.logger.log(
                  `Phát hiện ${otMinutesDetected} phút OT tiềm năng cho Staff ${staff.id} vào ngày ${date}`,
                );
                await this.otRequestRepo
                  .upsert(
                    {
                      staffId: staff.id,
                      date: date,
                      detectedDuration:
                        potentialOtDuration.toFormat('hh:mm:ss'),
                      status: OtRequestStatus.PENDING,
                    },
                    ['staffId', 'date'],
                  )
                  .catch((err) => {
                    this.logger.error(
                      `Lỗi khi upsert OT request cho staff ${staff.id} ngày ${date}: ${err.message}`,
                    );
                  });
                console.log(
                  ` -> Đã tạo/cập nhật yêu cầu OT chờ duyệt: ${potentialOtDuration.toFormat('hh:mm:ss')}`,
                );
              }
              potentialOtMinutes = Math.round(otMinutesDetected);
            } else if (staff.rates && staff.rates['part-time']) {
              // KHÔNG CÓ LỊCH (Part-time tự do)
              const durationMins = totalPayableDuration.as('minutes'); // Dùng giờ đã trừ lunch
              console.log(
                ` -> Không có lịch, tính là Part-time: ${durationMins} phút`,
              );
              finalWorkBlocks.push({
                type: 'part-time',
                duration: durationMins,
                pay: 0,
              });
              potentialOtMinutes = 0;
            }
          } // End if (firstCheckIn && lastCheckOut)

          // --- (Phần tính lương chuẩn và lương OT không thay đổi) ---
          dailyStandardPay = 0;
          finalWorkBlocks.forEach((block) => {
            const rateKey = block.type || 'part-time';
            const rate =
              (staff.rates && staff.rates[rateKey]) ||
              (staff.rates && staff.rates['part-time']) ||
              0;
            if (rate > 0 && block.duration > 0) {
              const pay = (block.duration / 60) * rate;
              dailyStandardPay += pay;
              block.pay = Math.round(pay);
            } else {
              block.pay = 0;
            }
          });
          console.log(
            ` -> Tiền lương giờ chuẩn (từ finalWorkBlocks): ${dailyStandardPay}`,
          );

          const approvedOt = approvedOtMap.get(`${staff.id}-${date}`);
          let otPay = 0;
          let approvedOtMinutes = 0;
          let otMultiplierUsed = 1.5;

          if (approvedOt && approvedOt.approvedDuration) {
            try {
              const relevantShiftSchedule = staffData?.schedules.find(
                (s) => s.date === date && s.shift,
              );
              otMultiplierUsed =
                relevantShiftSchedule?.shift?.otMultiplier || 1.5;

              let durationObj: Duration;
              if (
                typeof approvedOt.approvedDuration === 'object' &&
                approvedOt.approvedDuration !== null
              ) {
                durationObj = Duration.fromObject(
                  approvedOt.approvedDuration as any,
                );
              } else if (typeof approvedOt.approvedDuration === 'string') {
                try {
                  durationObj = Duration.fromISO(approvedOt.approvedDuration);
                } catch (isoError) {
                  const parts = approvedOt.approvedDuration
                    .split(':')
                    .map(Number);
                  if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
                    durationObj = Duration.fromObject({
                      hours: parts[0],
                      minutes: parts[1],
                      seconds: parts[2],
                    });
                  } else {
                    throw new Error(
                      `Invalid duration string format: ${approvedOt.approvedDuration}`,
                    );
                  }
                }
              } else {
                throw new Error(
                  `Invalid approvedDuration format: ${approvedOt.approvedDuration}`,
                );
              }
              if (!durationObj || !durationObj.isValid) {
                throw new Error(
                  `Parsed duration is invalid from: ${approvedOt.approvedDuration}`,
                );
              }
              approvedOtMinutes = durationObj.as('minutes');

              const baseRateForOt =
                (staff.rates && staff.rates['part-time']) ||
                Math.max(0, ...Object.values(staff.rates || { default: 0 }));
              if (baseRateForOt > 0) {
                otPay =
                  (approvedOtMinutes / 60) * baseRateForOt * otMultiplierUsed;
                console.log(
                  ` -> Ngày ${date}: Tính ${approvedOtMinutes} phút OT, Rate cơ sở ${baseRateForOt}, Hệ số ${otMultiplierUsed}, Tiền OT: ${otPay}`,
                );
              } else {
                this.logger.warn(
                  `Không tìm thấy rate cơ sở để tính OT cho staff ${staff.id} ngày ${date}`,
                );
              }
            } catch (e) {
              this.logger.error(
                `Lỗi khi tính tiền OT cho request ID ${approvedOt.id}: ${e.message}`,
                e.stack,
              );
            }
          }
          if (approvedOt) {
            console.log(
              ` -> OT đã duyệt: ${approvedOtMinutes} phút, Tiền OT: ${otPay}`,
            );
          } else {
            console.log(
              `    -> Không tìm thấy OT đã duyệt hoặc approvedDuration rỗng.`,
            );
          }

          totalPay += dailyStandardPay + otPay;
          dailyBreakdown.push({
            date,
            checkIn:
              firstCheckIn?.timestamp.toLocaleTimeString('vi-VN', {
                timeZone: VN_TIMEZONE,
              }) || 'N/A',
            checkOut:
              lastCheckOut?.timestamp.toLocaleTimeString('vi-VN', {
                timeZone: VN_TIMEZONE,
              }) || 'N/A',
            blocks: finalWorkBlocks,
            potentialOtMinutes,
            approvedOtMinutes: Math.round(approvedOtMinutes),
            otPay: Math.round(otPay),
            dailyPay: Math.round(dailyStandardPay + otPay),
          });
          console.log(` -> Tổng tiền ngày: ${dailyStandardPay + otPay}`);
        } // End date loop

        // --- (Xử lý ngày chỉ có OT - không đổi) ---
        approvedOtRequests.forEach((ot) => {
          if (ot.staffId === staff.id && !attendancesByDate[ot.date]) {
            // ... (toàn bộ logic tính otPay cho ngày chỉ có OT giữ nguyên) ...
            let otPay = 0;
            let approvedOtMinutes = 0;
            let otMultiplierUsed = 1.5;
            if (ot.approvedDuration) {
              try {
                const relevantShiftSchedule = staffData?.schedules.find(
                  (s) => s.date === ot.date && s.shift,
                );
                otMultiplierUsed =
                  relevantShiftSchedule?.shift?.otMultiplier || 1.5;
                let durationObj: Duration;
                if (
                  typeof ot.approvedDuration === 'object' &&
                  ot.approvedDuration !== null
                ) {
                  durationObj = Duration.fromObject(ot.approvedDuration as any);
                } else if (typeof ot.approvedDuration === 'string') {
                  try {
                    durationObj = Duration.fromISO(ot.approvedDuration);
                  } catch (isoError) {
                    const parts = ot.approvedDuration.split(':').map(Number);
                    if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
                      durationObj = Duration.fromObject({
                        hours: parts[0],
                        minutes: parts[1],
                        seconds: parts[2],
                      });
                    } else {
                      throw new Error(
                        `Invalid duration string format: ${ot.approvedDuration}`,
                      );
                    }
                  }
                } else {
                  throw new Error(
                    `Invalid approvedDuration format on OT Request ${ot.id}`,
                  );
                }
                if (!durationObj || !durationObj.isValid) {
                  throw new Error(
                    `Parsed duration is invalid from: ${ot.approvedDuration}`,
                  );
                }
                approvedOtMinutes = durationObj.as('minutes');
                const baseRateForOt =
                  (staff.rates && staff.rates['part-time']) ||
                  Math.max(0, ...Object.values(staff.rates || { default: 0 }));
                if (baseRateForOt > 0) {
                  otPay =
                    (approvedOtMinutes / 60) * baseRateForOt * otMultiplierUsed;
                  console.log(
                    ` -> Ngày ${ot.date} (Chỉ OT): Tính ${approvedOtMinutes} phút OT, Rate cơ sở ${baseRateForOt}, Hệ số ${otMultiplierUsed}, Tiền OT: ${otPay}`,
                  );
                } else {
                  this.logger.warn(
                    `Không tìm thấy rate cơ sở để tính OT (chỉ OT) cho staff ${staff.id} ngày ${ot.date}`,
                  );
                }
              } catch (e) {
                this.logger.error(
                  `Lỗi khi tính tiền OT (chỉ OT) cho request ID ${ot.id}: ${e.message}`,
                  e.stack,
                );
              }
            }
            if (otPay > 0) {
              totalPay += otPay;
              dailyBreakdown.push({
                date: ot.date,
                checkIn: 'N/A',
                checkOut: 'N/A',
                blocks: [],
                potentialOtMinutes: 0,
                approvedOtMinutes: Math.round(approvedOtMinutes),
                otPay: Math.round(otPay),
                dailyPay: Math.round(otPay),
              });
            }
          }
        });

        report.push({
          staffId: staff.id,
          fullName: staff.fullName,
          totalPay: Math.round(totalPay),
          dailyBreakdown,
        });
      } // End staff loop

      console.log('--- KẾT THÚC: Báo cáo (đã gồm OT duyệt) đã được tạo. ---');
      return report;
    } catch (error) {
      console.error(
        '!!! ĐÃ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH TẠO BÁO CÁO !!!',
        error,
      );
      this.logger.error('Payroll generation failed', error.stack);
      throw error;
    }
  }

  // --- (Hàm resolveOverlappingBlocks KHÔNG THAY ĐỔI) ---
  private resolveOverlappingBlocks(
    intersections: {
      interval: Interval;
      rateType: string | undefined;
      priority: number;
    }[],
    rates: Record<string, number>,
  ): { type: string | undefined; duration: number; pay: number }[] {
    if (!intersections || intersections.length === 0) {
      return [];
    }
    intersections.sort(
      (a, b) => a.interval.start.toMillis() - b.interval.start.toMillis(),
    );
    const resultBlocks: {
      type: string | undefined;
      duration: number;
      pay: number;
    }[] = [];
    const overallStart = DateTime.min(
      ...intersections.map((i) => i.interval.start),
    );
    const overallEnd = DateTime.max(
      ...intersections.map((i) => i.interval.end),
    );
    let processedUntil = overallStart;
    let currentTime = overallStart;
    while (currentTime < overallEnd) {
      const nextMinute = currentTime.plus({ minutes: 1 });
      let bestBlockForMinute: {
        interval: Interval;
        rateType: string | undefined;
        priority: number;
      } | null = null;
      const overlappingBlocks = intersections.filter((block) =>
        block.interval.contains(currentTime),
      );
      if (overlappingBlocks.length > 0) {
        bestBlockForMinute = overlappingBlocks.reduce(
          (best, current) => {
            if (!best) return current;
            const currentPriority = current.priority;
            const bestPriority = best.priority;
            if (currentPriority > bestPriority) return current;
            if (currentPriority < bestPriority) return best;
            const currentRate =
              (rates && current.rateType && rates[current.rateType]) || 0;
            const bestRate =
              (rates && best.rateType && rates[best.rateType]) || 0;
            return currentRate >= bestRate ? current : best;
          },
          null as typeof bestBlockForMinute,
        );
      }
      if (bestBlockForMinute) {
        const lastResultBlock = resultBlocks[resultBlocks.length - 1];
        if (
          lastResultBlock &&
          lastResultBlock.type === bestBlockForMinute.rateType &&
          currentTime >= processedUntil.minus({ milliseconds: 1 })
        ) {
          lastResultBlock.duration += 1;
        } else {
          resultBlocks.push({
            type: bestBlockForMinute.rateType,
            duration: 1,
            pay: 0,
          });
        }
        processedUntil =
          nextMinute > processedUntil ? nextMinute : processedUntil;
      }
      currentTime = nextMinute;
    }
    return resultBlocks;
  }

  // --- (Hàm groupAttendancesByDate KHÔNG THAY ĐỔI) ---
  private groupAttendancesByDate(attendances: StaffAttendanceEntity[]) {
    const initialValue: Record<string, StaffAttendanceEntity[]> = {};
    return attendances.reduce((acc, curr) => {
      const dt = DateTime.fromJSDate(curr.timestamp, { zone: VN_TIMEZONE });
      if (!dt.isValid) {
        this.logger.warn(
          `Invalid timestamp found for attendance ID: ${curr.id}, value: ${curr.timestamp}`,
        );
        return acc;
      }
      const date = dt.toISODate();
      if (!date) {
        this.logger.warn(
          `Could not extract date from valid DateTime for attendance ID: ${curr.id}`,
        );
        return acc;
      }
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(curr);
      return acc;
    }, initialValue);
  }
}
