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
      attendances.forEach((a) =>
        staffDataMap.get(a.staffId)?.attendances.push(a),
      );
      schedules.forEach((s) => staffDataMap.get(s.staffId)?.schedules.push(s));

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
          console.log(`\n--- Ngày ${date} ---`); // Log start of day
          const firstCheckIn = dailyAttendances.find(
            (a) => a.type === AttendanceType.CHECK_IN,
          );
          const lastCheckOut = [...dailyAttendances]
            .reverse()
            .find((a) => a.type === AttendanceType.CHECK_OUT);

          // Initialize daily variables
          let dailyStandardPay = 0; // Standard pay for the day
          let potentialOtMinutes = 0;
          const workBlocks = [];

          if (firstCheckIn && lastCheckOut) {
            // **APPLY TIMEZONE RIGHT AWAY**
            const checkInDt = DateTime.fromJSDate(
              firstCheckIn.timestamp,
            ).setZone(VN_TIMEZONE);
            const checkOutDt = DateTime.fromJSDate(
              lastCheckOut.timestamp,
            ).setZone(VN_TIMEZONE);

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

            if (dailySchedules.length > 0) {
              for (const schedule of dailySchedules) {
                let scheduleInterval: Interval | null = null;
                let rateType: string | undefined;

                // **APPLY TIMEZONE WHEN CREATING SCHEDULE INTERVALS**
                if (schedule.classSession) {
                  const start = DateTime.fromISO(
                    `${schedule.date}T${schedule.classSession.startTime}`,
                    { zone: VN_TIMEZONE },
                  );
                  const end = start.plus({ minutes: 90 });
                  scheduleInterval = Interval.fromDateTimes(start, end);
                  rateType = Object.keys(staff.rates || {}).find(
                    (k) => k.includes('teacher') || k.includes('assistance'),
                  );
                  console.log(
                    `    -> Lịch dạy: ${scheduleInterval?.start?.toFormat('HH:mm')} - ${scheduleInterval?.end?.toFormat('HH:mm')}`,
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
                  scheduleInterval = Interval.fromDateTimes(start, end);
                  rateType = 'part-time';
                  console.log(
                    `    -> Lịch ca: ${scheduleInterval?.start?.toFormat('HH:mm')} - ${scheduleInterval?.end?.toFormat('HH:mm')}`,
                  );
                }

                if (scheduleInterval) {
                  totalScheduledDuration = totalScheduledDuration.plus(
                    scheduleInterval.toDuration(),
                  );
                  // Calculate intersection (standard work block)
                  const intersection =
                    totalActualWorkInterval.intersection(scheduleInterval);
                  if (intersection) {
                    // **FIXED**: Use .as('minutes')
                    const durationMins = intersection
                      .toDuration()
                      .as('minutes');
                    console.log(
                      `    -> Giao với lịch: ${intersection.start?.toFormat('HH:mm')} - ${intersection.end?.toFormat('HH:mm')} (${durationMins} phút)`,
                    );
                    workBlocks.push({ type: rateType, duration: durationMins });
                  }
                }
              } // End schedule loop

              // Calculate potential OT = Actual - Scheduled
              let potentialOtDuration = totalActualDuration.minus(
                totalScheduledDuration,
              );
              if (potentialOtDuration.as('minutes') < 0) {
                potentialOtDuration = Duration.fromMillis(0);
              }
              console.log(
                ` -> Tổng giờ theo lịch: ${totalScheduledDuration.toFormat('hh:mm:ss')}`,
              );
              console.log(
                ` -> Giờ OT tiềm năng: ${potentialOtDuration.toFormat('hh:mm:ss')}`,
              );

              const otMinutesDetected = potentialOtDuration.as('minutes');
              if (otMinutesDetected > 1) {
                this.logger.log(
                  `Phát hiện ${otMinutesDetected} phút OT tiềm năng cho Staff ${staff.id} vào ngày ${date} (Thực tế: ${totalActualDuration.toFormat('hh:mm')}, Lịch: ${totalScheduledDuration.toFormat('hh:mm')})`,
                );
                await this.otRequestRepo.upsert(
                  {
                    staffId: staff.id,
                    date: date,
                    detectedDuration: potentialOtDuration.toFormat('hh:mm:ss'), // Correct format
                    status: OtRequestStatus.PENDING,
                  },
                  ['staffId', 'date'],
                );
                console.log(
                  ` -> Đã tạo/cập nhật yêu cầu OT chờ duyệt: ${potentialOtDuration.toFormat('hh:mm:ss')}`,
                );
              }
              potentialOtMinutes = Math.round(otMinutesDetected);
            } else if (staff.rates && staff.rates['part-time']) {
              // NO SCHEDULE (Free Part-time)
              // **FIXED**: Use .as('minutes')
              const durationMins = totalActualDuration.as('minutes');
              console.log(
                ` -> Không có lịch, tính là Part-time: ${durationMins} phút`,
              );
              workBlocks.push({ type: 'part-time', duration: durationMins });
              potentialOtMinutes = 0;
            }
          } // End if (firstCheckIn && lastCheckOut)

          // --- CALCULATE STANDARD PAY ---
          workBlocks.forEach((block) => {
            const rate =
              (staff.rates && staff.rates[block.type]) ||
              (staff.rates && staff.rates['part-time']) ||
              0;
            if (rate > 0 && block.duration > 0) {
              const pay = (block.duration / 60) * rate;
              dailyStandardPay += pay; // Accumulate standard pay
              block.pay = Math.round(pay);
            } else {
              block.pay = 0;
            }
          });
          console.log(' -> Giờ làm chuẩn (Work Blocks):', workBlocks);
          console.log(` -> Tiền lương giờ chuẩn: ${dailyStandardPay}`);

          // --- CALCULATE APPROVED OT PAY ---
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
                const parts = approvedOt.approvedDuration
                  .split(':')
                  .map(Number);
                durationObj = Duration.fromObject({
                  hours: parts[0] || 0,
                  minutes: parts[1] || 0,
                  seconds: parts[2] || 0,
                });
              } else {
                throw new Error(
                  `Invalid approvedDuration format: ${approvedOt.approvedDuration}`,
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

          totalPay += dailyStandardPay + otPay; // Add both standard and OT pay to total
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
            blocks: workBlocks,
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
                  const parts = ot.approvedDuration.split(':').map(Number);
                  durationObj = Duration.fromObject({
                    hours: parts[0] || 0,
                    minutes: parts[1] || 0,
                    seconds: parts[2] || 0,
                  });
                } else {
                  throw new Error(
                    `Invalid approvedDuration format on OT Request ${ot.id}`,
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
      throw error;
    }
  }

  private groupAttendancesByDate(attendances: StaffAttendanceEntity[]) {
    const initialValue: Record<string, StaffAttendanceEntity[]> = {};
    return attendances.reduce((acc, curr) => {
      // Use Luxon to handle timezone correctly when determining the date
      const date = DateTime.fromJSDate(curr.timestamp, {
        zone: VN_TIMEZONE,
      }).toISODate();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(curr);
      return acc;
    }, initialValue);
  }
}
