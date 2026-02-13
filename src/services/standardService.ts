import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { RecurrenceType, WorkOrderPriority, WorkOrderStatus, DayOfWeek } from '../../generated/prisma';

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
}

export interface GenerateWorkOrdersDto {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  standardIds?: string[];
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
  async getAll(onlyActive?: boolean) {
    const where: any = {};
    if (onlyActive !== undefined) {
      where.isActive = onlyActive;
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
        workOrders: {
          orderBy: { scheduledDate: 'desc' },
          take: 20,
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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

  async generateWorkOrders(data: GenerateWorkOrdersDto, createdById: string) {
    const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number);
    const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    // Fetch active standards
    const where: any = { isActive: true };
    if (data.standardIds && data.standardIds.length > 0) {
      where.id = { in: data.standardIds };
    }

    const standards = await prisma.standard.findMany({ where });

    if (standards.length === 0) {
      return { message: 'Nema aktivnih standarda za generisanje', count: 0 };
    }

    // Get existing work orders for deduplication
    const existingWorkOrders = await prisma.workOrder.findMany({
      where: {
        standardId: { in: standards.map(s => s.id) },
        scheduledDate: {
          gte: start,
          lte: new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59)),
        },
      },
      select: {
        standardId: true,
        scheduledDate: true,
      },
    });

    // Build set of existing standard+date combos for deduplication
    const existingSet = new Set(
      existingWorkOrders.map(wo => {
        const dateStr = wo.scheduledDate?.toISOString().split('T')[0];
        return `${wo.standardId}_${dateStr}`;
      })
    );

    // Build work orders to create
    const workOrdersToCreate: any[] = [];

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = DAY_INDEX_MAP[currentDate.getUTCDay()];
      const dateStr = currentDate.toISOString().split('T')[0];

      for (const standard of standards) {
        // Check recurrence match
        let matches = false;
        if (standard.recurrenceType === RecurrenceType.DAILY) {
          // Only workdays (Monday-Friday) for daily standards
          const jsDay = currentDate.getUTCDay();
          matches = jsDay >= 1 && jsDay <= 5;
        } else if (standard.recurrenceType === RecurrenceType.WEEKLY) {
          matches = standard.daysOfWeek.includes(dayOfWeek);
        }

        if (!matches) continue;

        // Deduplicate
        const key = `${standard.id}_${dateStr}`;
        if (existingSet.has(key)) continue;

        // Parse times
        const [startH, startM] = standard.startTime.split(':').map(Number);
        const [endH, endM] = standard.endTime.split(':').map(Number);

        const scheduledDate = new Date(Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate(),
          startH, startM
        ));

        const deadline = new Date(Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate(),
          endH, endM
        ));

        // Handle overnight/24h shifts: if deadline <= scheduledDate, shift spans midnight
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
          assignedToId: standard.defaultAssignedToId,
          standardId: standard.id,
        });
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (workOrdersToCreate.length === 0) {
      return { message: 'Nema novih naloga za generisanje (već postoje ili nema podudaranja)', count: 0 };
    }

    // Create in transaction with status history entries
    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const wo of workOrdersToCreate) {
        const workOrder = await tx.workOrder.create({
          data: {
            ...wo,
            statusHistory: {
              create: {
                oldStatus: null,
                newStatus: WorkOrderStatus.NEW,
                note: 'Radni nalog generisan iz standarda',
              },
            },
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
