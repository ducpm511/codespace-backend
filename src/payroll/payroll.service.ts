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

    // --- TIME RANGE QUERY LOGIC ---
    const scheduleWhereCondition = {
      date: Between(fromDate, toDate),
      ...(staffId && { staffId: parseInt(staffId, 10) }),
    };

    const attendanceWhereCondition = {
      timestamp: Raw(
        (alias) => `${alias} >= :fromDate AND ${alias} < :toDate`,
        {
          fromDate: fromDate, // Start of the day implicitly
          toDate: DateTime.fromISO(toDate).plus({ days: 1 }).toISODate(), // Exclusive end date
        },
      ),
      ...(staffId && { staffId: parseInt(staffId, 10) }),
    };
    console.log('2. Điều kiện truy vấn Attendances:', {
      from: fromDate,
      to_exclusive: DateTime.fromISO(toDate).plus({ days: 1 }).toISODate(),
    });

    // Get approved OT
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

      console.log(
        `3. KẾT QUẢ TRUY VẤN ATTENDANCES: Tìm thấy ${attendances.length} bản ghi.`,
      );
      if (attendances.length > 0)
        console.log('Bản ghi đầu tiên:', attendances[0]);
      console.log(
        `3.1 KẾT QUẢ TRUY VẤN OT ĐÃ DUYỆT: Tìm thấy ${approvedOtRequests.length} bản ghi.`,
      );

      if (attendances.length === 0 && approvedOtRequests.length === 0) {
        console.log('--- DỪNG LẠI: Không có chấm công hay OT được duyệt. ---');
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

      // Group approved OT
      const approvedOtMap = new Map<string, OtRequestEntity>();
      approvedOtRequests.forEach((ot) => {
        approvedOtMap.set(`${ot.staffId}-${ot.date}`, ot);
      });

      console.log('4. Dữ liệu đã được gom nhóm.');

      const report = [];

      for (const staff of staffList) {
        const staffHasApprovedOt = approvedOtRequests.some(
          (ot) => ot.staffId === staff.id,
        );
        if (!staff.rates && !staffHasApprovedOt) {
          console.log(
            ` -> Bỏ qua nhân viên ${staff.fullName} (không có rates và không có OT).`,
          );
          continue;
        }

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

          // Initialize daily variables
          let dailyStandardPay = 0;
          let potentialOtMinutes = 0;
          let finalWorkBlocks: {
            type: string | undefined;
            duration: number;
            pay: number;
          }[] = []; // Final prioritized blocks

          if (firstCheckIn && lastCheckOut) {
            const checkInDt = DateTime.fromJSDate(
              firstCheckIn.timestamp,
            ).setZone(VN_TIMEZONE);
            const checkOutDt = DateTime.fromJSDate(
              lastCheckOut.timestamp,
            ).setZone(VN_TIMEZONE);

            if (checkOutDt <= checkInDt) {
              console.log(
                ` -> Lỗi dữ liệu ngày ${date}: CheckOut (${checkOutDt.toISO()}) không sau CheckIn (${checkInDt.toISO()}). Bỏ qua ngày này.`,
              );
              continue;
            }

            const totalActualWorkInterval = Interval.fromDateTimes(
              checkInDt,
              checkOutDt,
            );
            const totalActualDuration = totalActualWorkInterval.toDuration();
            console.log(
              ` -> CheckIn: ${checkInDt.toFormat('HH:mm:ss')}, CheckOut: ${checkOutDt.toFormat('HH:mm:ss')}, Tổng Thực tế: ${totalActualDuration.toFormat('hh:mm:ss')}`,
            );

            const dailySchedules =
              staffData?.schedules.filter((s) => s.date === date) || [];
            let totalScheduledDuration = Duration.fromMillis(0);
            console.log(
              ` -> Số lịch trình trong ngày: ${dailySchedules.length}`,
            );

            // --- STEP 1: CALCULATE ALL POTENTIAL INTERSECTIONS ---
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
                  // Use a fixed duration for class sessions for simplicity, adjust if needed

                  scheduleInterval = Interval.fromDateTimes(paidStart, paidEnd);
                  rateType = schedule.roleKey || undefined; // Use assigned role key
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
                  // Ensure end is after start for valid interval
                  if (end > start) {
                    scheduleInterval = Interval.fromDateTimes(start, end);
                    rateType = 'part-time'; // Assume shifts are part-time rate
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
                  const intersection =
                    totalActualWorkInterval.intersection(scheduleInterval);
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
                }
              } // End schedule loop

              // --- STEP 2: RESOLVE OVERLAPS AND PRIORITIZE ---
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

              // --- STEP 3: CALCULATE REMAINING PART-TIME ---
              let calculatedStandardDuration = Duration.fromMillis(0);
              finalWorkBlocks.forEach((block) => {
                calculatedStandardDuration = calculatedStandardDuration.plus({
                  minutes: block.duration,
                });
              });

              const remainingDuration = totalActualDuration.minus(
                calculatedStandardDuration,
              );
              // Ensure remaining duration is positive before adding as part-time
              if (
                remainingDuration.as('minutes') > 1 &&
                staff.rates &&
                staff.rates['part-time']
              ) {
                const remainingMinutes = remainingDuration.as('minutes');
                console.log(
                  ` -> Giờ làm Part-time còn lại (ngoài lịch): ${remainingMinutes} phút`,
                );
                finalWorkBlocks.push({
                  type: 'part-time',
                  duration: remainingMinutes,
                  pay: 0,
                });
              }

              // --- STEP 4: CALCULATE POTENTIAL OT (Actual - Total Scheduled) ---
              let potentialOtDuration = totalActualDuration.minus(
                totalScheduledDuration,
              );
              // Ensure potential OT is not negative
              if (potentialOtDuration.as('minutes') < 0) {
                potentialOtDuration = Duration.fromMillis(0);
              }
              console.log(
                ` -> Tổng giờ theo lịch: ${totalScheduledDuration.toFormat('hh:mm:ss')}`,
              );
              console.log(
                ` -> Giờ OT tiềm năng (Thực tế - Lịch): ${potentialOtDuration.toFormat('hh:mm:ss')}`,
              );

              const otMinutesDetected = potentialOtDuration.as('minutes');
              if (otMinutesDetected > 1) {
                // Only create request if OT > 1 min
                this.logger.log(
                  `Phát hiện ${otMinutesDetected} phút OT tiềm năng cho Staff ${staff.id} vào ngày ${date} (Thực tế: ${totalActualDuration.toFormat('hh:mm')}, Lịch: ${totalScheduledDuration.toFormat('hh:mm')})`,
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
                    ['staffId', 'date'], // Conflict target
                  )
                  .catch((err) => {
                    // Add error handling for upsert
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
              // NO SCHEDULE (Free Part-time)
              const durationMins = totalActualDuration.as('minutes');
              console.log(
                ` -> Không có lịch, tính là Part-time: ${durationMins} phút`,
              );
              finalWorkBlocks.push({
                type: 'part-time',
                duration: durationMins,
                pay: 0,
              });
              potentialOtMinutes = 0; // No potential OT for purely unscheduled work by default
            }
          } // End if (firstCheckIn && lastCheckOut)

          // --- STEP 5: CALCULATE STANDARD PAY FROM FINAL BLOCKS ---
          dailyStandardPay = 0;
          finalWorkBlocks.forEach((block) => {
            // Use optional chaining and provide default rate key
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

          // --- STEP 6: CALCULATE APPROVED OT PAY ---
          const approvedOt = approvedOtMap.get(`${staff.id}-${date}`);
          let otPay = 0;
          let approvedOtMinutes = 0;
          let otMultiplierUsed = 1.5;

          if (approvedOt && approvedOt.approvedDuration) {
            try {
              const relevantShiftSchedule = staffData?.schedules.find(
                (s) => s.date === date && s.shift,
              );
              // Ensure shift exists before accessing otMultiplier
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
                // Be more robust parsing HH:MM:SS or potentially other interval formats from DB
                try {
                  // First try ISO format (like PT1H30M)
                  durationObj = Duration.fromISO(approvedOt.approvedDuration);
                } catch (isoError) {
                  // Fallback to HH:MM:SS parsing
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

              // Check if duration is valid after parsing
              if (!durationObj || !durationObj.isValid) {
                throw new Error(
                  `Parsed duration is invalid from: ${approvedOt.approvedDuration}`,
                );
              }

              approvedOtMinutes = durationObj.as('minutes');

              // Ensure rates exist before trying to access 'part-time' or other keys
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
                e.stack, // Log stack for more details
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
          // --- END CALCULATE APPROVED OT PAY ---

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
            blocks: finalWorkBlocks, // Use finalWorkBlocks which now includes pay
            potentialOtMinutes,
            approvedOtMinutes: Math.round(approvedOtMinutes),
            otPay: Math.round(otPay),
            dailyPay: Math.round(dailyStandardPay + otPay), // Total for the day
          });
          console.log(` -> Tổng tiền ngày: ${dailyStandardPay + otPay}`);
        } // End date loop

        // --- Handle days with only approved OT ---
        approvedOtRequests.forEach((ot) => {
          if (ot.staffId === staff.id && !attendancesByDate[ot.date]) {
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
                  // Robust parsing for HH:MM:SS or ISO
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
      this.logger.error('Payroll generation failed', error.stack); // Log full stack trace
      throw error; // Re-throw the error to be handled by NestJS
    }
  }

  // --- NEW HELPER FUNCTION TO RESOLVE OVERLAPS ---
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

    // Sort intersections by start time
    intersections.sort(
      (a, b) => a.interval.start.toMillis() - b.interval.start.toMillis(),
    );

    const resultBlocks: {
      type: string | undefined;
      duration: number;
      pay: number;
    }[] = [];

    // Determine the overall time span
    const overallStart = DateTime.min(
      ...intersections.map((i) => i.interval.start),
    );
    const overallEnd = DateTime.max(
      ...intersections.map((i) => i.interval.end),
    );

    // Initialize processedUntil to overallStart so it's always defined
    let processedUntil = overallStart;
    let currentTime = overallStart;

    while (currentTime < overallEnd) {
      const nextMinute = currentTime.plus({ minutes: 1 });
      // Consider the interval for the *current* minute being processed
      // Contains checks typically exclude the end time, so we check if the interval *contains* the start time of the minute
      // Alternatively, check if the minute interval overlaps with the block interval

      let bestBlockForMinute: {
        interval: Interval;
        rateType: string | undefined;
        priority: number;
      } | null = null;

      // Find all blocks that overlap with the start of the current minute
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
            // If priorities and rates are equal, keep the 'best' one found first (arbitrary but consistent)
            return currentRate >= bestRate ? current : best;
          },
          null as typeof bestBlockForMinute,
        );
      }

      // Merge consecutive minutes with the same winning block
      if (bestBlockForMinute) {
        const lastResultBlock = resultBlocks[resultBlocks.length - 1];
        // Check if the current minute's winner is the same type as the last added block
        // AND if the current minute immediately follows the processed timeline
        if (
          lastResultBlock &&
          lastResultBlock.type === bestBlockForMinute.rateType &&
          currentTime >= processedUntil.minus({ milliseconds: 1 })
        ) {
          // Check continuity
          lastResultBlock.duration += 1; // Increment duration
        } else {
          // Start a new block if type changes or there was a gap
          resultBlocks.push({
            type: bestBlockForMinute.rateType,
            duration: 1,
            pay: 0,
          });
        }
        // Update the timeline marker to the end of the current minute
        processedUntil =
          nextMinute > processedUntil ? nextMinute : processedUntil;
      }
      // If no block covers this minute (gap), simply move on.

      currentTime = nextMinute; // Move to the next minute
    }

    return resultBlocks;
  }

  private groupAttendancesByDate(attendances: StaffAttendanceEntity[]) {
    const initialValue: Record<string, StaffAttendanceEntity[]> = {};
    return attendances.reduce((acc, curr) => {
      // Use Luxon to handle timezone correctly when determining the date
      const dt = DateTime.fromJSDate(curr.timestamp, { zone: VN_TIMEZONE });
      if (!dt.isValid) {
        // Add validation check
        this.logger.warn(
          `Invalid timestamp found for attendance ID: ${curr.id}, value: ${curr.timestamp}`,
        );
        return acc;
      }
      const date = dt.toISODate();
      if (!date) {
        // Check if date string is null/undefined
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
