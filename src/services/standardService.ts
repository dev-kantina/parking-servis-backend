import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { RecurrenceType, WorkOrderPriority, WorkOrderStatus, DayOfWeek } from '../../generated/prisma';
import { toBusinessUTC, formatBusinessDate, getBusinessDayBounds } from '../utils/timezone';

export interface CreateStandardDto {
  title: string;
  description: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  recurrenceType: RecurrenceType;
  daysOfWeek?: DayOfWeek[];
  startTime: string;
  endTime: string;
  defaultAssignedToId?: string;
  groupId?: string;
}

export interface UpdateStandardDto {
  title?: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  recurrenceType?: RecurrenceType;
  daysOfWeek?: DayOfWeek[];
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  defaultAssignedToId?: string | null;
  groupId?: string | null;
}

export interface StandardFilters {
  onlyActive?: boolean;
  groupId?: string | null;
  search?: string;
  defaultAssignedToId?: string | null;
  recurrenceType?: RecurrenceType;
  priority?: WorkOrderPriority;
}

export interface GenerateOverride {
  standardId: string;
  originalDate: string; // YYYY-MM-DD the algorithm would have picked
  action: 'move' | 'skip';
  newDate?: string;     // YYYY-MM-DD when action === 'move'
}

export interface GenerateWorkOrdersDto {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  standardIds?: string[];
  overrides?: GenerateOverride[];
}

export interface PreviewOccurrence {
  standardId: string;
  standardTitle: string;
  date: string;          // YYYY-MM-DD (after weekend shift)
  originalDate: string;  // YYYY-MM-DD (before weekend shift, for override keying)
  shifted: boolean;      // true if weekend-shifted
  startTime: string;
  endTime: string;
  alreadyExists: boolean;
}

const DAY_INDEX_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export class StandardService {
  async getAll(filters: StandardFilters = {}) {
    const where: any = {};
    if (filters.onlyActive !== undefined) {
      where.isActive = filters.onlyActive;
    }
    if (filters.groupId === null) {
      where.groupId = null;
    } else if (filters.groupId) {
      where.groupId = filters.groupId;
    }
    if (filters.defaultAssignedToId === null) {
      where.defaultAssignedToId = null;
    } else if (filters.defaultAssignedToId) {
      where.defaultAssignedToId = filters.defaultAssignedToId;
    }
    if (filters.recurrenceType) {
      where.recurrenceType = filters.recurrenceType;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const standards = await prisma.standard.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        defaultAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { workOrders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return standards;
  }

  async getById(id: string) {
    const standard = await prisma.standard.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        defaultAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        workOrders: {
          orderBy: { scheduledDate: 'desc' },
          take: 20,
          include: {
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { workOrders: true },
        },
      },
    });

    if (!standard) {
      throw ApiError.notFound('Standard nije pronađen');
    }

    return standard;
  }

  async create(data: CreateStandardDto, createdById: string) {
    if (data.defaultAssignedToId) {
      const user = await prisma.user.findUnique({
        where: { id: data.defaultAssignedToId },
      });
      if (!user) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije pronađen');
      }
      if (!user.isActive) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije aktivan');
      }
    }

    if (data.groupId) {
      const group = await prisma.standardGroup.findUnique({
        where: { id: data.groupId },
      });
      if (!group) {
        throw ApiError.badRequest('Grupa standarda nije pronađena');
      }
    }

    const standard = await prisma.standard.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        priority: data.priority || WorkOrderPriority.MEDIUM,
        recurrenceType: data.recurrenceType,
        daysOfWeek: data.daysOfWeek || [],
        startTime: data.startTime,
        endTime: data.endTime,
        createdById,
        defaultAssignedToId: data.defaultAssignedToId,
        groupId: data.groupId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        defaultAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return standard;
  }

  async update(id: string, data: UpdateStandardDto) {
    const existing = await prisma.standard.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Standard nije pronađen');
    }

    if (data.defaultAssignedToId) {
      const user = await prisma.user.findUnique({
        where: { id: data.defaultAssignedToId },
      });
      if (!user) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije pronađen');
      }
      if (!user.isActive) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije aktivan');
      }
    }

    if (data.groupId) {
      const group = await prisma.standardGroup.findUnique({
        where: { id: data.groupId },
      });
      if (!group) {
        throw ApiError.badRequest('Grupa standarda nije pronađena');
      }
    }

    const standard = await prisma.standard.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.recurrenceType !== undefined && { recurrenceType: data.recurrenceType }),
        ...(data.daysOfWeek !== undefined && { daysOfWeek: data.daysOfWeek }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.defaultAssignedToId !== undefined && { defaultAssignedToId: data.defaultAssignedToId }),
        ...(data.groupId !== undefined && { groupId: data.groupId }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        defaultAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return standard;
  }

  async delete(id: string) {
    const existing = await prisma.standard.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Standard nije pronađen');
    }

    await prisma.standard.delete({ where: { id } });

    return { message: 'Standard uspješno obrisan' };
  }

  /**
   * Compute raw occurrence dates (YYYY-MM-DD) for a standard within [start, end].
   * Does NOT apply weekend shift. DAILY already filters to Mon-Fri.
   */
  private computeOccurrences(
    standard: { id: string; recurrenceType: RecurrenceType; daysOfWeek: DayOfWeek[]; createdAt: Date },
    start: Date,
    end: Date,
  ): string[] {
    const dates: string[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const jsDay = currentDate.getUTCDay();
      const dayOfWeek = DAY_INDEX_MAP[jsDay];
      const dateStr = currentDate.toISOString().split('T')[0];

      let matches = false;
      if (standard.recurrenceType === RecurrenceType.DAILY) {
        matches = jsDay >= 1 && jsDay <= 5;
      } else if (standard.recurrenceType === RecurrenceType.WEEKLY) {
        matches = standard.daysOfWeek.includes(dayOfWeek);
      } else if (standard.recurrenceType === RecurrenceType.BIWEEKLY) {
        const createdDate = new Date(standard.createdAt);
        const createdUTC = Date.UTC(createdDate.getUTCFullYear(), createdDate.getUTCMonth(), createdDate.getUTCDate());
        const currentUTC = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
        const diffDays = Math.round((currentUTC - createdUTC) / (1000 * 60 * 60 * 24));
        matches = diffDays >= 0 && diffDays % 15 === 0;
      } else if (standard.recurrenceType === RecurrenceType.MONTHLY) {
        const createdDay = new Date(standard.createdAt).getUTCDate();
        const currentDay = currentDate.getUTCDate();
        const lastDayOfMonth = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)).getUTCDate();
        matches = currentDay === Math.min(createdDay, lastDayOfMonth);
      }

      if (matches) dates.push(dateStr);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return dates;
  }

  /**
   * Shift a YYYY-MM-DD forward to Monday if it falls on Sat/Sun.
   * Applied only to BIWEEKLY and MONTHLY (DAILY already skips weekends; WEEKLY is user-picked).
   */
  private shiftWeekendToMonday(dateStr: string): { date: string; shifted: boolean } {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const jsDay = date.getUTCDay(); // 0=Sun, 6=Sat
    if (jsDay === 6) {
      date.setUTCDate(date.getUTCDate() + 2);
      return { date: date.toISOString().split('T')[0], shifted: true };
    }
    if (jsDay === 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      return { date: date.toISOString().split('T')[0], shifted: true };
    }
    return { date: dateStr, shifted: false };
  }

  async previewGeneration(data: GenerateWorkOrdersDto): Promise<PreviewOccurrence[]> {
    const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number);
    const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    const where: any = { isActive: true };
    if (data.standardIds && data.standardIds.length > 0) {
      where.id = { in: data.standardIds };
    }
    const standards = await prisma.standard.findMany({ where });
    if (standards.length === 0) return [];

    // Collect occurrences, applying weekend shift for BIWEEKLY/MONTHLY
    const rawOccurrences: PreviewOccurrence[] = [];
    for (const standard of standards) {
      const dates = this.computeOccurrences(standard, start, end);
      for (const originalDate of dates) {
        const shouldShift =
          standard.recurrenceType === RecurrenceType.BIWEEKLY ||
          standard.recurrenceType === RecurrenceType.MONTHLY;
        const { date, shifted } = shouldShift
          ? this.shiftWeekendToMonday(originalDate)
          : { date: originalDate, shifted: false };

        rawOccurrences.push({
          standardId: standard.id,
          standardTitle: standard.title,
          date,
          originalDate,
          shifted,
          startTime: standard.startTime,
          endTime: standard.endTime,
          alreadyExists: false,
        });
      }
    }

    // Check dedup against existing work orders (widen range in case shift pushed past end)
    const allDates = Array.from(new Set(rawOccurrences.map((o) => o.date))).sort();
    if (allDates.length === 0) return rawOccurrences;
    const { start: dedupStart } = getBusinessDayBounds(allDates[0]);
    const { end: dedupEnd } = getBusinessDayBounds(allDates[allDates.length - 1]);
    const existingWorkOrders = await prisma.workOrder.findMany({
      where: {
        standardId: { in: standards.map((s) => s.id) },
        scheduledDate: { gte: dedupStart, lte: dedupEnd },
      },
      select: { standardId: true, scheduledDate: true },
    });
    const existingSet = new Set(
      existingWorkOrders.map((wo) => {
        const dateStr = wo.scheduledDate ? formatBusinessDate(wo.scheduledDate) : '';
        return `${wo.standardId}_${dateStr}`;
      }),
    );
    for (const occ of rawOccurrences) {
      occ.alreadyExists = existingSet.has(`${occ.standardId}_${occ.date}`);
    }

    return rawOccurrences.sort((a, b) =>
      a.date === b.date
        ? a.standardTitle.localeCompare(b.standardTitle)
        : a.date.localeCompare(b.date),
    );
  }

  async generateWorkOrders(data: GenerateWorkOrdersDto, createdById: string) {
    // Reject past date ranges
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number);
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    if (end < todayUTC) {
      throw ApiError.badRequest('Nije moguće generisati naloge za prošle periode');
    }

    // Reuse preview to get the list of occurrences (already deduplicated, weekend-shifted)
    const occurrences = await this.previewGeneration(data);
    if (occurrences.length === 0) {
      return { message: 'Nema aktivnih standarda za generisanje', count: 0 };
    }

    // Build override lookup: key by standardId + originalDate
    const overrideMap = new Map<string, GenerateOverride>();
    for (const ov of data.overrides ?? []) {
      overrideMap.set(`${ov.standardId}_${ov.originalDate}`, ov);
    }

    // Load standards once for data we need (description, location, etc.)
    const standardIds = Array.from(new Set(occurrences.map((o) => o.standardId)));
    const standards = await prisma.standard.findMany({
      where: { id: { in: standardIds } },
    });
    const standardMap = new Map(standards.map((s) => [s.id, s]));

    const workOrdersToCreate: any[] = [];

    for (const occ of occurrences) {
      if (occ.alreadyExists) continue;

      const override = overrideMap.get(`${occ.standardId}_${occ.originalDate}`);
      if (override?.action === 'skip') continue;

      const finalDate =
        override?.action === 'move' && override.newDate
          ? override.newDate
          : occ.date;

      const standard = standardMap.get(occ.standardId);
      if (!standard) continue;

      const scheduledDate = toBusinessUTC(finalDate, standard.startTime);
      const deadline = toBusinessUTC(finalDate, standard.endTime);
      if (deadline.getTime() <= scheduledDate.getTime()) {
        deadline.setUTCDate(deadline.getUTCDate() + 1);
      }

      workOrdersToCreate.push({
        title: `[Standard] ${standard.title}`,
        description: standard.description,
        location: standard.location,
        latitude: standard.latitude,
        longitude: standard.longitude,
        priority: standard.priority,
        status: WorkOrderStatus.NEW,
        scheduledDate,
        deadline,
        createdById,
        defaultAssignedToId: standard.defaultAssignedToId,
        standardId: standard.id,
      });
    }

    if (workOrdersToCreate.length === 0) {
      return { message: 'Nema novih naloga za generisanje (već postoje ili nema podudaranja)', count: 0 };
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const wo of workOrdersToCreate) {
        const { defaultAssignedToId, ...woData } = wo;
        const workOrder = await tx.workOrder.create({
          data: {
            ...woData,
            statusHistory: {
              create: {
                oldStatus: null,
                newStatus: WorkOrderStatus.NEW,
                note: 'Radni nalog generisan iz standarda',
              },
            },
            ...(defaultAssignedToId && {
              assignments: {
                create: { userId: defaultAssignedToId },
              },
            }),
          },
        });
        created.push(workOrder);
      }
      return created;
    });

    return {
      message: `Generisano ${result.length} radnih naloga`,
      count: result.length,
    };
  }
}

export default new StandardService();
