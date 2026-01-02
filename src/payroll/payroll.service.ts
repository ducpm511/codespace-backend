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

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

const ROLE_PRIORITY: Record<string, number> = {
  teacher: 3,
  'teaching-assistant': 2,
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

    const allOtWhereCondition = {
      date: Between(fromDate, toDate),
      ...(staffId && { staffId: parseInt(staffId, 10) }),
    };

    try {
      const [attendances, schedules, staffList, allOtRequests] =
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
          this.otRequestRepo.find({ where: allOtWhereCondition }),
        ]);

      if (attendances.length === 0 && allOtRequests.length === 0) {
        return [];
      }

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

      const otRequestMap = new Map<string, OtRequestEntity>();
      allOtRequests.forEach((ot) => {
        otRequestMap.set(`${ot.staffId}-${ot.date}`, ot);
      });

      const report = [];

      for (const staff of staffList) {
        const staffHasOt = allOtRequests.some((ot) => ot.staffId === staff.id);
        if (!staff.rates && !staffHasOt) {
          continue;
        }

        let totalPay = 0;
        const dailyBreakdown = [];
        const staffData = staffDataMap.get(staff.id);

        const attendancesByDate = this.groupAttendancesByDate(
          staffData?.attendances || [],
        );

        for (const [date, dailyAttendances] of Object.entries(
          attendancesByDate,
        )) {
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

          if (dailyAttendances.length >= 2) {
            dailyAttendances.sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
            );

            // Định nghĩa giờ nghỉ trưa
            const lunchStart = DateTime.fromISO(`${date}T11:45:00`, {
              zone: VN_TIMEZONE,
            });
            const lunchEnd = DateTime.fromISO(`${date}T13:15:00`, {
              zone: VN_TIMEZONE,
            });
            const lunchInterval = Interval.fromDateTimes(lunchStart, lunchEnd);

            let totalPayableDuration = Duration.fromMillis(0);
            const payableWorkIntervals: Interval[] = [];

            // 1. TÍNH TỔNG GIỜ LÀM THỰC TẾ (SMART LUNCH DEDUCTION)
            for (let i = 0; i < dailyAttendances.length - 1; i++) {
              const current = dailyAttendances[i];
              const next = dailyAttendances[i + 1];

              if (
                current.type === AttendanceType.CHECK_IN &&
                next.type === AttendanceType.CHECK_OUT
              ) {
                const inTime = DateTime.fromJSDate(current.timestamp).setZone(
                  VN_TIMEZONE,
                );
                const outTime = DateTime.fromJSDate(next.timestamp).setZone(
                  VN_TIMEZONE,
                );

                if (outTime > inTime) {
                  const workInterval = Interval.fromDateTimes(inTime, outTime);

                  // --- LOGIC TRỪ GIỜ TRƯA THÔNG MINH ---
                  // Chỉ trừ nếu ca làm việc BẮT ĐẦU TRƯỚC 11:45 và KẾT THÚC SAU 13:15
                  let actualWorkParts: Interval[] = [workInterval];

                  if (
                    workInterval.start < lunchStart &&
                    workInterval.end > lunchEnd
                  ) {
                    actualWorkParts = workInterval.difference(lunchInterval);
                  }

                  actualWorkParts.forEach((part) => {
                    totalPayableDuration = totalPayableDuration.plus(
                      part.toDuration(),
                    );
                    payableWorkIntervals.push(part);
                  });

                  i++; // Skip next checkout
                }
              }
            }

            console.log(
              ` -> Ngày ${date}: Thực tế (Smart Lunch): ${totalPayableDuration.toFormat('hh:mm')}`,
            );

            // 2. TÍNH CÁC CA LÀM VIỆC (STANDARD PAY)
            const dailySchedules =
              staffData?.schedules.filter((s) => s.date === date) || [];

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
                    rateType = schedule.roleKey || 'part-time';
                    priority = ROLE_PRIORITY[rateType] || 0;
                  }
                }

                if (scheduleInterval) {
                  payableWorkIntervals.forEach((payableInterval) => {
                    const intersection =
                      payableInterval.intersection(scheduleInterval);
                    if (intersection && intersection.isValid) {
                      potentialIntersections.push({
                        interval: intersection,
                        rateType,
                        priority,
                      });
                    }
                  });
                }
              }

              finalWorkBlocks = this.resolveOverlappingBlocks(
                potentialIntersections,
                staff.rates || {},
              );

              // 3. TÍNH OT TIỀM NĂNG (RESIDUAL)
              let calculatedStandardDuration = Duration.fromMillis(0);
              finalWorkBlocks.forEach((block) => {
                calculatedStandardDuration = calculatedStandardDuration.plus({
                  minutes: block.duration,
                });
              });

              let potentialOtDuration = totalPayableDuration.minus(
                calculatedStandardDuration,
              );

              if (potentialOtDuration.as('minutes') < 1) {
                potentialOtDuration = Duration.fromMillis(0);
              }

              const otMinutesDetected = potentialOtDuration.as('minutes');

              // --- LOGIC GHI OT ---
              const existingOt = otRequestMap.get(`${staff.id}-${date}`);

              if (otMinutesDetected > 1) {
                if (existingOt) {
                  if (
                    existingOt.detectedDuration !==
                    potentialOtDuration.toFormat('hh:mm:ss')
                  ) {
                    await this.otRequestRepo.update(existingOt.id, {
                      detectedDuration:
                        potentialOtDuration.toFormat('hh:mm:ss'),
                    });
                  }
                } else {
                  await this.otRequestRepo.save({
                    staffId: staff.id,
                    date: date,
                    detectedDuration: potentialOtDuration.toFormat('hh:mm:ss'),
                    status: OtRequestStatus.PENDING,
                  });
                }
              } else {
                if (
                  existingOt &&
                  existingOt.status === OtRequestStatus.PENDING
                ) {
                  await this.otRequestRepo.delete(existingOt.id);
                }
              }

              potentialOtMinutes = Math.round(otMinutesDetected);
            } else if (staff.rates && staff.rates['part-time']) {
              const durationMins = totalPayableDuration.as('minutes');
              finalWorkBlocks.push({
                type: 'part-time',
                duration: durationMins,
                pay: 0,
              });
              potentialOtMinutes = 0;
            }
          }

          // --- TÍNH TIỀN LƯƠNG CHUẨN ---
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

          // --- TÍNH TIỀN LƯƠNG OT ĐÃ DUYỆT (HỖ TRỢ BREAKDOWN) ---
          const otRequest = otRequestMap.get(`${staff.id}-${date}`);
          let otPay = 0;
          let approvedOtMinutes = 0;

          if (otRequest && otRequest.status === OtRequestStatus.APPROVED) {
            try {
              // Ưu tiên 1: Tính theo mảng Breakdown (Split OT)
              if (
                otRequest.breakdown &&
                Array.isArray(otRequest.breakdown) &&
                otRequest.breakdown.length > 0
              ) {
                for (const item of otRequest.breakdown) {
                  const roleKey = item.role;
                  const durationStr = item.duration;
                  const multiplier = item.multiplier || 1.5;
                  const baseRate = (staff.rates && staff.rates[roleKey]) || 0;

                  let minutes = 0;
                  try {
                    const parts = durationStr.split(':').map(Number);
                    minutes = parts[0] * 60 + parts[1];
                  } catch (e) {}

                  if (minutes > 0 && baseRate > 0) {
                    const pay = (minutes / 60) * baseRate * multiplier;
                    otPay += pay;
                    approvedOtMinutes += minutes;

                    finalWorkBlocks.push({
                      type: `OT-${roleKey} (x${multiplier})`,
                      duration: minutes,
                      pay: Math.round(pay),
                    });
                  }
                }
              }
              // Ưu tiên 2: Tính theo cách cũ (Gộp) nếu không có breakdown
              else if (
                otRequest.approvedDuration &&
                otRequest.approvedRoleKey
              ) {
                const roleKey = otRequest.approvedRoleKey;
                const otMultiplier = otRequest.approvedMultiplier || 1;
                const baseRateForOt =
                  (staff.rates && staff.rates[roleKey]) || 0;

                let durationObj: Duration;
                // ... (Logic parse duration cũ) ...
                if (
                  typeof otRequest.approvedDuration === 'object' &&
                  otRequest.approvedDuration !== null
                ) {
                  durationObj = Duration.fromObject(
                    otRequest.approvedDuration as any,
                  );
                } else if (typeof otRequest.approvedDuration === 'string') {
                  try {
                    durationObj = Duration.fromISO(otRequest.approvedDuration);
                  } catch (e) {
                    const parts = otRequest.approvedDuration
                      .split(':')
                      .map(Number);
                    if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
                      durationObj = Duration.fromObject({
                        hours: parts[0],
                        minutes: parts[1],
                        seconds: parts[2],
                      });
                    } else {
                      throw new Error('Invalid duration');
                    }
                  }
                } else {
                  throw new Error('Invalid duration');
                }

                if (durationObj && durationObj.isValid) {
                  const minutes = durationObj.as('minutes');
                  approvedOtMinutes += minutes;
                  if (baseRateForOt > 0) {
                    const pay = (minutes / 60) * baseRateForOt * otMultiplier;
                    otPay += pay;

                    finalWorkBlocks.push({
                      type: `OT (${roleKey})`,
                      duration: minutes,
                      pay: Math.round(pay),
                    });
                  }
                }
              }
            } catch (e) {
              this.logger.error(`Lỗi tính OT: ${e.message}`);
            }
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
        }

        // --- Xử lý ngày CHỈ CÓ OT (Cũng hỗ trợ Breakdown) ---
        allOtRequests.forEach((ot) => {
          if (
            ot.staffId === staff.id &&
            !attendancesByDate[ot.date] &&
            ot.status === OtRequestStatus.APPROVED
          ) {
            let otPayOnly = 0;
            let approvedOtMinutesOnly = 0;
            const otBlocksOnly: {
              type: string | undefined;
              duration: number;
              pay: number;
            }[] = [];

            try {
              // Breakdown logic cho ngày chỉ OT
              if (
                ot.breakdown &&
                Array.isArray(ot.breakdown) &&
                ot.breakdown.length > 0
              ) {
                for (const item of ot.breakdown) {
                  const roleKey = item.role;
                  const durationStr = item.duration;
                  const multiplier = item.multiplier || 1.5;
                  const baseRate = (staff.rates && staff.rates[roleKey]) || 0;

                  let minutes = 0;
                  try {
                    const parts = durationStr.split(':').map(Number);
                    minutes = parts[0] * 60 + parts[1];
                  } catch (e) {}

                  if (minutes > 0 && baseRate > 0) {
                    const pay = (minutes / 60) * baseRate * multiplier;
                    otPayOnly += pay;
                    approvedOtMinutesOnly += minutes;

                    otBlocksOnly.push({
                      type: `OT-${roleKey} (x${multiplier})`,
                      duration: minutes,
                      pay: Math.round(pay),
                    });
                  }
                }
              }
              // Old logic fallback
              else if (ot.approvedDuration && ot.approvedRoleKey) {
                const roleKey = ot.approvedRoleKey;
                const otMultiplier = ot.approvedMultiplier || 1;
                const baseRateForOt =
                  (staff.rates && staff.rates[roleKey]) || 0;

                let durationObj: Duration;
                // ... (Parse duration logic - rút gọn) ...
                if (typeof ot.approvedDuration === 'string') {
                  try {
                    durationObj = Duration.fromISO(ot.approvedDuration);
                  } catch (e) {
                    const parts = ot.approvedDuration.split(':').map(Number);
                    durationObj = Duration.fromObject({
                      hours: parts[0],
                      minutes: parts[1],
                      seconds: parts[2],
                    });
                  }
                } else {
                  durationObj = Duration.fromObject(ot.approvedDuration as any);
                }

                const minutes = durationObj.as('minutes');
                approvedOtMinutesOnly = minutes;

                if (baseRateForOt > 0) {
                  const pay = (minutes / 60) * baseRateForOt * otMultiplier;
                  otPayOnly = pay;
                  otBlocksOnly.push({
                    type: `OT (${roleKey})`,
                    duration: minutes,
                    pay: Math.round(pay),
                  });
                }
              }
            } catch (e) {}

            if (otPayOnly > 0) {
              totalPay += otPayOnly;
              dailyBreakdown.push({
                date: ot.date,
                checkIn: 'N/A',
                checkOut: 'N/A',
                blocks: otBlocksOnly,
                potentialOtMinutes: 0,
                approvedOtMinutes: Math.round(approvedOtMinutesOnly),
                otPay: Math.round(otPayOnly),
                dailyPay: Math.round(otPayOnly),
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
      }

      console.log('--- KẾT THÚC: Báo cáo đã được tạo. ---');
      return report;
    } catch (error) {
      console.error('!!! LỖI !!!', error);
      this.logger.error('Payroll generation failed', error.stack);
      throw error;
    }
  }

  // --- Helper functions (ResolveOverlapping & GroupByDate) giữ nguyên ---
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
            if (current.priority > best.priority) return current;
            if (current.priority < best.priority) return best;

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

  private groupAttendancesByDate(attendances: StaffAttendanceEntity[]) {
    const initialValue: Record<string, StaffAttendanceEntity[]> = {};
    return attendances.reduce((acc, curr) => {
      const dt = DateTime.fromJSDate(curr.timestamp, { zone: VN_TIMEZONE });
      if (!dt.isValid) return acc;
      const date = dt.toISODate();
      if (!date) return acc;
      if (!acc[date]) acc[date] = [];
      acc[date].push(curr);
      return acc;
    }, initialValue);
  }
}
