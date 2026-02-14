import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { DayOfWeek } from '../../generated/prisma';
import { getBusinessToday, getBusinessYesterday, getBusinessDayOfWeek, parseDate } from '../utils/timezone';

// Weekly template DTOs
export interface SetScheduleEntryDto {
  userId: string;
  dayOfWeek: DayOfWeek;
  shiftId: string;
}

export interface BulkScheduleDto {
  userId: string;
  schedule: {
    dayOfWeek: DayOfWeek;
    shiftId: string | null; // null means no shift (day off)
  }[];
}

// Date-specific entry DTOs
export interface SetDateEntryDto {
  userId: string;
  date: string; // ISO date string YYYY-MM-DD
  shiftId: string;
  note?: string;
}

export interface GenerateScheduleDto {
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
  userIds?: string[]; // Optional: specific users, otherwise all workers
}

export class ScheduleService {
  async getAll() {
    const schedules = await prisma.employeeSchedule.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        shift: true,
      },
      orderBy: [
        { user: { firstName: 'asc' } },
        { dayOfWeek: 'asc' },
      ],
    });

    return schedules;
  }

  async getByUserId(userId: string) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    const schedules = await prisma.employeeSchedule.findMany({
      where: { userId },
      include: {
        shift: true,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    return schedules;
  }

  async setScheduleEntry(data: SetScheduleEntryDto) {
    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    if (!user.isActive) {
      throw ApiError.badRequest('Nije moguće dodijeliti smjenu neaktivnom korisniku');
    }

    // Verify shift exists and is active
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
    });

    if (!shift) {
      throw ApiError.notFound('Smjena nije pronađena');
    }

    if (!shift.isActive) {
      throw ApiError.badRequest('Nije moguće dodijeliti neaktivnu smjenu');
    }

    // Upsert - create or update the schedule entry
    const schedule = await prisma.employeeSchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId: data.userId,
          dayOfWeek: data.dayOfWeek,
        },
      },
      update: {
        shiftId: data.shiftId,
      },
      create: {
        userId: data.userId,
        dayOfWeek: data.dayOfWeek,
        shiftId: data.shiftId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: true,
      },
    });

    return schedule;
  }

  async bulkUpdateUserSchedule(data: BulkScheduleDto) {
    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    if (!user.isActive) {
      throw ApiError.badRequest('Nije moguće dodijeliti smjene neaktivnom korisniku');
    }

    // Validate all shifts exist and are active
    const shiftIds = data.schedule
      .filter(s => s.shiftId !== null)
      .map(s => s.shiftId as string);

    if (shiftIds.length > 0) {
      const shifts = await prisma.shift.findMany({
        where: { id: { in: shiftIds } },
      });

      const activeShiftIds = shifts.filter(s => s.isActive).map(s => s.id);
      const invalidShiftIds = shiftIds.filter(id => !activeShiftIds.includes(id));

      if (invalidShiftIds.length > 0) {
        throw ApiError.badRequest('Neke smjene nisu pronađene ili su neaktivne');
      }
    }

    // Use transaction to update all schedules atomically
    const result = await prisma.$transaction(async (tx) => {
      const operations = [];

      for (const entry of data.schedule) {
        if (entry.shiftId === null) {
          // Delete the schedule entry for this day (day off)
          operations.push(
            tx.employeeSchedule.deleteMany({
              where: {
                userId: data.userId,
                dayOfWeek: entry.dayOfWeek,
              },
            })
          );
        } else {
          // Upsert the schedule entry
          operations.push(
            tx.employeeSchedule.upsert({
              where: {
                userId_dayOfWeek: {
                  userId: data.userId,
                  dayOfWeek: entry.dayOfWeek,
                },
              },
              update: {
                shiftId: entry.shiftId,
              },
              create: {
                userId: data.userId,
                dayOfWeek: entry.dayOfWeek,
                shiftId: entry.shiftId,
              },
            })
          );
        }
      }

      await Promise.all(operations);

      // Return updated schedule
      return tx.employeeSchedule.findMany({
        where: { userId: data.userId },
        include: {
          shift: true,
        },
        orderBy: { dayOfWeek: 'asc' },
      });
    });

    return result;
  }

  async deleteScheduleEntry(id: string) {
    const schedule = await prisma.employeeSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw ApiError.notFound('Raspored nije pronađen');
    }

    await prisma.employeeSchedule.delete({
      where: { id },
    });

    return { message: 'Raspored uspješno obrisan' };
  }

  async deleteUserDaySchedule(userId: string, dayOfWeek: DayOfWeek) {
    const schedule = await prisma.employeeSchedule.findUnique({
      where: {
        userId_dayOfWeek: {
          userId,
          dayOfWeek,
        },
      },
    });

    if (!schedule) {
      throw ApiError.notFound('Raspored nije pronađen');
    }

    await prisma.employeeSchedule.delete({
      where: { id: schedule.id },
    });

    return { message: 'Raspored uspješno obrisan' };
  }

  async getScheduleMatrix() {
    // Get all active workers with their schedules
    const workers = await prisma.user.findMany({
      where: {
        role: 'WORKER',
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        weeklySchedules: {
          include: {
            shift: true,
          },
        },
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    // Transform to matrix format
    return workers.map(worker => {
      const scheduleMap: Record<DayOfWeek, { shiftId: string; shiftName: string; startTime: string; endTime: string } | null> = {
        MONDAY: null,
        TUESDAY: null,
        WEDNESDAY: null,
        THURSDAY: null,
        FRIDAY: null,
        SATURDAY: null,
        SUNDAY: null,
      };

      for (const schedule of worker.weeklySchedules) {
        scheduleMap[schedule.dayOfWeek] = {
          shiftId: schedule.shift.id,
          shiftName: schedule.shift.name,
          startTime: schedule.shift.startTime,
          endTime: schedule.shift.endTime,
        };
      }

      return {
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email,
        schedule: scheduleMap,
      };
    });
  }

  // ========================================
  // DATE-SPECIFIC SCHEDULE ENTRY METHODS
  // ========================================

  async getEntriesByDateRange(startDate: string, endDate: string, userId?: string) {
    // Parse date strings as UTC midnight (database stores dates as UTC midnight)
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));

    const where: any = {
      date: {
        gte: start,
        lte: end,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    const entries = await prisma.scheduleEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: true,
      },
      orderBy: [
        { date: 'asc' },
        { user: { firstName: 'asc' } },
      ],
    });

    return entries;
  }

  async setDateEntry(data: SetDateEntryDto) {
    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    if (!user.isActive) {
      throw ApiError.badRequest('Nije moguće dodijeliti smjenu neaktivnom korisniku');
    }

    // Verify shift exists and is active
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
    });

    if (!shift) {
      throw ApiError.notFound('Smjena nije pronađena');
    }

    if (!shift.isActive) {
      throw ApiError.badRequest('Nije moguće dodijeliti neaktivnu smjenu');
    }

    // Parse date string as UTC midnight (database stores dates as UTC midnight)
    const [year, month, day] = data.date.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Upsert - create or update the entry
    const entry = await prisma.scheduleEntry.upsert({
      where: {
        userId_date: {
          userId: data.userId,
          date,
        },
      },
      update: {
        shiftId: data.shiftId,
        note: data.note,
      },
      create: {
        userId: data.userId,
        date,
        shiftId: data.shiftId,
        note: data.note,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: true,
      },
    });

    return entry;
  }

  async deleteDateEntry(userId: string, date: string) {
    // Parse date string as UTC midnight (database stores dates as UTC midnight)
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    const entry = await prisma.scheduleEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateObj,
        },
      },
    });

    if (!entry) {
      throw ApiError.notFound('Unos rasporeda nije pronađen');
    }

    await prisma.scheduleEntry.delete({
      where: { id: entry.id },
    });

    return { message: 'Unos rasporeda uspješno obrisan' };
  }

  async generateFromTemplate(data: GenerateScheduleDto) {
    // Parse date strings as UTC midnight (database stores dates as UTC midnight)
    const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number);
    const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));

    // Get workers to generate schedules for
    const whereUsers: any = {
      role: 'WORKER',
      isActive: true,
    };

    if (data.userIds && data.userIds.length > 0) {
      whereUsers.id = { in: data.userIds };
    }

    // Get all workers with their weekly templates
    const workers = await prisma.user.findMany({
      where: whereUsers,
      include: {
        weeklySchedules: {
          include: {
            shift: true,
          },
        },
      },
    });

    const daysMap: Record<number, DayOfWeek> = {
      0: 'SUNDAY',
      1: 'MONDAY',
      2: 'TUESDAY',
      3: 'WEDNESDAY',
      4: 'THURSDAY',
      5: 'FRIDAY',
      6: 'SATURDAY',
    };

    const entriesToCreate: { userId: string; date: Date; shiftId: string }[] = [];

    // Iterate through each day in the range (using UTC methods)
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = daysMap[currentDate.getUTCDay()];

      for (const worker of workers) {
        // Find template for this day
        const template = worker.weeklySchedules.find(s => s.dayOfWeek === dayOfWeek);

        if (template) {
          entriesToCreate.push({
            userId: worker.id,
            date: new Date(currentDate),
            shiftId: template.shiftId,
          });
        }
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Use createMany with skipDuplicates to avoid overwriting existing entries
    const result = await prisma.scheduleEntry.createMany({
      data: entriesToCreate,
      skipDuplicates: true,
    });

    return {
      message: `Generisano ${result.count} unosa rasporeda`,
      count: result.count,
    };
  }

  async getCalendarView(startDate: string, endDate: string) {
    // Parse date strings as UTC midnight (database stores dates as UTC midnight)
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));

    // Get all active workers
    const workers = await prisma.user.findMany({
      where: {
        role: 'WORKER',
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { firstName: 'asc' },
    });

    // Get all entries in the date range
    const entries = await prisma.scheduleEntry.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        shift: true,
      },
    });

    // Build date list (using UTC methods since we're working with UTC dates)
    const dates: string[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Build calendar matrix
    const calendar = workers.map(worker => {
      const schedule: Record<string, { shiftId: string; shiftName: string; startTime: string; endTime: string; note?: string } | null> = {};

      for (const date of dates) {
        const entry = entries.find(
          e => e.userId === worker.id && e.date.toISOString().split('T')[0] === date
        );

        if (entry) {
          schedule[date] = {
            shiftId: entry.shift.id,
            shiftName: entry.shift.name,
            startTime: entry.shift.startTime,
            endTime: entry.shift.endTime,
            note: entry.note || undefined,
          };
        } else {
          schedule[date] = null;
        }
      }

      return {
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email,
        schedule,
      };
    });

    return {
      dates,
      workers: calendar,
    };
  }

  async getMyShiftToday(userId: string) {
    const now = new Date();
    const todayStr = getBusinessToday(now);
    const yesterdayStr = getBusinessYesterday(now);
    const todayDow = getBusinessDayOfWeek(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDow = getBusinessDayOfWeek(yesterdayDate);

    // Helper: get shift for a specific date, checking ScheduleEntry first, then EmployeeSchedule
    const getShiftForDate = async (dateStr: string, dayOfWeek: DayOfWeek) => {
      const dateObj = parseDate(dateStr);

      // Check date-specific entry first
      const entry = await prisma.scheduleEntry.findUnique({
        where: {
          userId_date: { userId, date: dateObj },
        },
        include: { shift: true },
      });

      if (entry) {
        return {
          shiftName: entry.shift.name,
          startTime: entry.shift.startTime,
          endTime: entry.shift.endTime,
        };
      }

      // Fall back to weekly template
      const weekly = await prisma.employeeSchedule.findUnique({
        where: {
          userId_dayOfWeek: { userId, dayOfWeek },
        },
        include: { shift: true },
      });

      if (weekly) {
        return {
          shiftName: weekly.shift.name,
          startTime: weekly.shift.startTime,
          endTime: weekly.shift.endTime,
        };
      }

      return null;
    };

    const todayShift = await getShiftForDate(todayStr, todayDow);

    // Only fetch yesterday's shift if it's overnight (endTime < startTime)
    const yesterdayCandidate = await getShiftForDate(yesterdayStr, yesterdayDow);
    const yesterdayShift =
      yesterdayCandidate && yesterdayCandidate.endTime < yesterdayCandidate.startTime
        ? yesterdayCandidate
        : null;

    return { todayShift, yesterdayShift };
  }

  async getWorkersAvailableOnDate(date: string) {
    // Parse date string as UTC midnight (database stores dates as UTC midnight)
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Get workers who have a schedule entry for this date
    const entries = await prisma.scheduleEntry.findMany({
      where: {
        date: dateObj,
        user: {
          isActive: true,
        },
        shift: {
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    return entries.map(entry => ({
      id: entry.user.id,
      firstName: entry.user.firstName,
      lastName: entry.user.lastName,
      email: entry.user.email,
      shift: entry.shift,
    }));
  }
}

export default new ScheduleService();
