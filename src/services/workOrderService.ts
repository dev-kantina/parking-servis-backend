import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import notificationService from './notificationService';
import { WorkOrderStatus, WorkOrderPriority, Role } from '../../generated/prisma';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { STATUS_LABELS } from '../constants';

export interface WorkOrderEquipmentInput {
  equipmentId: string;
  quantity: number;
}

export interface CreateWorkOrderDto {
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  scheduledDate?: Date;
  deadline?: Date;
  resources?: string;
  assignedToId?: string;
  equipment?: WorkOrderEquipmentInput[];
}

export interface UpdateWorkOrderDto {
  title?: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  scheduledDate?: Date;
  deadline?: Date;
  resources?: string;
  assignedToId?: string | null;
  equipment?: WorkOrderEquipmentInput[];
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assignedToId?: string;
  createdById?: string;
  search?: string;
  scheduledDateBefore?: Date;
  scheduledDateAfter?: Date;
  deadlineBefore?: Date;
  deadlineAfter?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

// Definisanje validnih prelaza statusa za radnike
const WORKER_STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.NEW]: [WorkOrderStatus.ACCEPTED, WorkOrderStatus.DECLINED],
  [WorkOrderStatus.ACCEPTED]: [WorkOrderStatus.IN_PROGRESS],
  [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.ON_HOLD, WorkOrderStatus.COMPLETED],
  [WorkOrderStatus.ON_HOLD]: [WorkOrderStatus.IN_PROGRESS],
  [WorkOrderStatus.COMPLETED]: [],
  [WorkOrderStatus.CANCELLED]: [],
  [WorkOrderStatus.DECLINED]: [],
};

// Admin/Manager može mijenjati status u bilo koji drugi status
const ALL_STATUSES = [
  WorkOrderStatus.NEW,
  WorkOrderStatus.ACCEPTED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED,
  WorkOrderStatus.DECLINED,
];

// Funkcija za dobijanje dozvoljenih prelaza na osnovu uloge
const getStatusTransitions = (status: WorkOrderStatus, role: Role): WorkOrderStatus[] => {
  if (role === Role.ADMINISTRATOR || role === Role.MANAGER) {
    // Admin/Manager može mijenjati u bilo koji status osim trenutnog
    return ALL_STATUSES.filter(s => s !== status);
  }
  return WORKER_STATUS_TRANSITIONS[status];
};

export class WorkOrderService {
  async getAll(filters: WorkOrderFilters = {}, pagination: PaginationOptions = { page: 1, limit: 10 }) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.scheduledDateBefore) {
      where.scheduledDate = { ...where.scheduledDate, lte: filters.scheduledDateBefore };
    }

    if (filters.scheduledDateAfter) {
      where.scheduledDate = { ...where.scheduledDate, gte: filters.scheduledDateAfter };
    }

    if (filters.deadlineBefore) {
      where.deadline = { ...where.deadline, lte: filters.deadlineBefore };
    }

    if (filters.deadlineAfter) {
      where.deadline = { ...where.deadline, gte: filters.deadlineAfter };
    }

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' }, // Hitni nalozi prvo
          { deadline: 'asc' }, // Bliži rokovi prije
          { createdAt: 'desc' },
        ],
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.workOrder.count({ where }),
    ]);

    return {
      data: workOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const workOrder = await prisma.workOrder.findUnique({
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
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
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        requiredEquipment: {
          include: {
            equipment: {
              include: {
                type: true,
              },
            },
          },
        },
      },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    return workOrder;
  }

  async create(data: CreateWorkOrderDto, createdById: string) {
    // Provjera da li dodijeljeni korisnik postoji i da li je radnik
    if (data.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      });

      if (!assignedUser) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije pronađen');
      }

      if (!assignedUser.isActive) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije aktivan');
      }
    }

    // Validate equipment if provided
    if (data.equipment && data.equipment.length > 0) {
      const equipmentIds = data.equipment.map((e) => e.equipmentId);
      const existingEquipment = await prisma.equipment.findMany({
        where: {
          id: { in: equipmentIds },
          isActive: true,
        },
      });

      if (existingEquipment.length !== equipmentIds.length) {
        throw ApiError.badRequest('Neka od odabrane opreme nije pronađena ili nije aktivna');
      }
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        priority: data.priority || WorkOrderPriority.MEDIUM,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        resources: data.resources,
        createdById,
        assignedToId: data.assignedToId,
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: WorkOrderStatus.NEW,
            note: 'Radni nalog kreiran',
          },
        },
        ...(data.equipment && data.equipment.length > 0 && {
          requiredEquipment: {
            create: data.equipment.map((e) => ({
              equipmentId: e.equipmentId,
              quantity: e.quantity,
            })),
          },
        }),
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        requiredEquipment: {
          include: {
            equipment: {
              include: {
                type: true,
              },
            },
          },
        },
      },
    });

    if (data.assignedToId) {
      await notificationService.create({
        userId: data.assignedToId,
        type: 'NEW_ASSIGNMENT',
        title: 'Novi radni nalog',
        message: `Dodijeljen vam je novi radni nalog: ${workOrder.title}`,
        workOrderId: workOrder.id,
        sentById: createdById,
      });
    }

    return workOrder;
  }

  async update(id: string, data: UpdateWorkOrderDto, userId: string, userRole: Role) {
    const currentWorkOrder = await prisma.workOrder.findUnique({
      where: { id },
    });

    if (!currentWorkOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    // Radnik može ažurirati samo naloge koji su mu dodijeljeni
    if (userRole === Role.WORKER && currentWorkOrder.assignedToId !== userId) {
      throw ApiError.forbidden('Nemate dozvolu za uređivanje ovog naloga');
    }

    // Završeni, otkazani i odbijeni nalozi se ne mogu uređivati
    if (([WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED, WorkOrderStatus.DECLINED] as WorkOrderStatus[]).includes(currentWorkOrder.status)) {
      throw ApiError.badRequest('Završeni, otkazani ili odbijeni nalozi se ne mogu uređivati');
    }

    // Provjera novog dodijeljenog korisnika
    if (data.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      });

      if (!assignedUser) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije pronađen');
      }

      if (!assignedUser.isActive) {
        throw ApiError.badRequest('Dodijeljeni korisnik nije aktivan');
      }
    }

    // Validate equipment if provided
    if (data.equipment && data.equipment.length > 0) {
      const equipmentIds = data.equipment.map((e) => e.equipmentId);
      const existingEquipment = await prisma.equipment.findMany({
        where: {
          id: { in: equipmentIds },
          isActive: true,
        },
      });

      if (existingEquipment.length !== equipmentIds.length) {
        throw ApiError.badRequest('Neka od odabrane opreme nije pronađena ili nije aktivna');
      }
    }

    // If equipment is being updated, delete existing and create new
    if (data.equipment !== undefined) {
      await prisma.workOrderEquipment.deleteMany({
        where: { workOrderId: id },
      });
    }

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.location && { location: data.location }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.priority && { priority: data.priority }),
        ...(data.scheduledDate !== undefined && { scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null }),
        ...(data.deadline && { deadline: new Date(data.deadline) }),
        ...(data.resources !== undefined && { resources: data.resources }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.equipment !== undefined && data.equipment.length > 0 && {
          requiredEquipment: {
            create: data.equipment.map((e) => ({
              equipmentId: e.equipmentId,
              quantity: e.quantity,
            })),
          },
        }),
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        requiredEquipment: {
          include: {
            equipment: {
              include: {
                type: true,
              },
            },
          },
        },
      },
    });

    if (data.assignedToId && data.assignedToId !== currentWorkOrder.assignedToId) {
      await notificationService.create({
        userId: data.assignedToId,
        type: 'NEW_ASSIGNMENT',
        title: 'Novi radni nalog',
        message: `Dodijeljen vam je novi radni nalog: ${updatedWorkOrder.title}`,
        workOrderId: updatedWorkOrder.id,
        sentById: userId,
      });
    }

    return updatedWorkOrder;
  }

  async updateStatus(id: string, newStatus: WorkOrderStatus, userId: string, userRole: Role, note?: string) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    // Radnik može mijenjati status samo naloga koji su mu dodijeljeni
    if (userRole === Role.WORKER && workOrder.assignedToId !== userId) {
      throw ApiError.forbidden('Nemate dozvolu za promjenu statusa ovog naloga');
    }

    // Provjera validnog prelaza statusa na osnovu uloge korisnika
    const allowedTransitions = getStatusTransitions(workOrder.status, userRole);
    if (!allowedTransitions.includes(newStatus)) {
      throw ApiError.badRequest(
        `Nije moguć prelaz iz statusa "${workOrder.status}" u status "${newStatus}"`
      );
    }

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === WorkOrderStatus.COMPLETED && { completedAt: new Date() }),
        statusHistory: {
          create: {
            oldStatus: workOrder.status,
            newStatus,
            note,
          },
        },
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (updatedWorkOrder.createdById && updatedWorkOrder.createdById !== userId) {
      await notificationService.create({
        userId: updatedWorkOrder.createdById,
        type: 'STATUS_CHANGE',
        title: 'Promjena statusa',
        message: `Status naloga "${updatedWorkOrder.title}" je promijenjen u ${STATUS_LABELS[newStatus]}.`,
        workOrderId: updatedWorkOrder.id,
        sentById: userId,
        emailData: {
          oldStatus: workOrder.status,
          newStatus: newStatus,
          note: note,
        },
      });
    }

    return updatedWorkOrder;
  }

  async delete(id: string) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    await prisma.workOrder.delete({
      where: { id },
    });

    return { message: 'Radni nalog uspješno obrisan' };
  }

  async getMyOrders(userId: string, filters: WorkOrderFilters = {}, pagination: PaginationOptions = { page: 1, limit: 10 }) {
    return this.getAll({ ...filters, assignedToId: userId }, pagination);
  }

  async getStats() {
    const [statusCounts, priorityCounts, deadlineStats, recentOrders] = await Promise.all([
      // Brojanje po statusu
      prisma.workOrder.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Brojanje po prioritetu
      prisma.workOrder.groupBy({
        by: ['priority'],
        _count: true,
      }),
      // Nalozi blizu isteka roka (sljedećih 24h)
      prisma.workOrder.count({
        where: {
          deadline: {
            gte: new Date(),
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          status: {
            notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED, WorkOrderStatus.DECLINED],
          },
        },
      }),
      // Poslednji nalozi
      prisma.workOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    // Transformacija u objekat
    const byStatus: Record<string, number> = {};
    statusCounts.forEach((s) => {
      byStatus[s.status] = s._count;
    });

    const byPriority: Record<string, number> = {};
    priorityCounts.forEach((p) => {
      byPriority[p.priority] = p._count;
    });

    return {
      byStatus: {
        NEW: byStatus.NEW || 0,
        ACCEPTED: byStatus.ACCEPTED || 0,
        IN_PROGRESS: byStatus.IN_PROGRESS || 0,
        ON_HOLD: byStatus.ON_HOLD || 0,
        COMPLETED: byStatus.COMPLETED || 0,
        CANCELLED: byStatus.CANCELLED || 0,
        DECLINED: byStatus.DECLINED || 0,
      },
      byPriority: {
        LOW: byPriority.LOW || 0,
        MEDIUM: byPriority.MEDIUM || 0,
        HIGH: byPriority.HIGH || 0,
        URGENT: byPriority.URGENT || 0,
      },
      nearingDeadline: deadlineStats,
      recentOrders,
    };
  }

  async getCalendarData(year: number, month: number, workerId?: string) {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));

    // Get all work orders that overlap with this month
    // A work order overlaps if:
    // - Created before month end AND (not completed OR completed after month start)
    // - OR deadline is within the month
    const workOrders = await prisma.workOrder.findMany({
      where: {
        AND: [
          // Work order was created before or during this month
          { createdAt: { lte: monthEnd } },
          // Either not completed, or completed during/after this month starts
          {
            OR: [
              { completedAt: null },
              { completedAt: { gte: monthStart } },
            ],
          },
          // Optional worker filter
          ...(workerId ? [{ assignedToId: workerId }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        location: true,
        priority: true,
        status: true,
        createdAt: true,
        deadline: true,
        completedAt: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    // Calculate daily summary for the month
    const dailySummary: Record<string, {
      total: number;
      completed: number;
      inProgress: number;
      overdue: number;
      deadlines: number;
    }> = {};

    // Initialize all days in the month
    const currentDate = new Date(monthStart);
    while (currentDate <= monthEnd) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailySummary[dateKey] = {
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        deadlines: 0,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process each work order
    workOrders.forEach((wo) => {
      const deadlineDate = wo.deadline?.toISOString().split('T')[0];
      const completedDate = wo.completedAt?.toISOString().split('T')[0];

      // Count deadline
      if (deadlineDate && dailySummary[deadlineDate]) {
        dailySummary[deadlineDate].deadlines++;
      }

      // Count completion
      if (completedDate && dailySummary[completedDate]) {
        dailySummary[completedDate].completed++;
      }

      // For each day the work order was active
      const orderStart = new Date(Math.max(wo.createdAt.getTime(), monthStart.getTime()));
      const orderEnd = wo.completedAt
        ? new Date(Math.min(wo.completedAt.getTime(), monthEnd.getTime()))
        : monthEnd;

      const iterDate = new Date(orderStart);
      while (iterDate <= orderEnd) {
        const dateKey = iterDate.toISOString().split('T')[0];
        if (dailySummary[dateKey]) {
          dailySummary[dateKey].total++;

          if (wo.status === WorkOrderStatus.IN_PROGRESS) {
            dailySummary[dateKey].inProgress++;
          }

          // Check if overdue on this day
          if (!wo.completedAt && wo.deadline && iterDate > wo.deadline) {
            dailySummary[dateKey].overdue++;
          }
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }
    });

    // Format work orders for calendar
    const calendarOrders = workOrders.map((wo) => {
      const isOverdue = !wo.completedAt && !!wo.deadline && new Date() > wo.deadline;
      const isCompletedLate = !!wo.completedAt && !!wo.deadline && wo.completedAt > wo.deadline;

      return {
        id: wo.id,
        title: wo.title,
        location: wo.location,
        priority: wo.priority,
        status: wo.status,
        startDate: wo.createdAt.toISOString(),
        endDate: wo.completedAt?.toISOString() || wo.deadline?.toISOString() || null,
        deadline: wo.deadline?.toISOString() || null,
        completedAt: wo.completedAt?.toISOString() || null,
        isOverdue,
        isCompletedLate,
        worker: wo.assignedTo
          ? {
              id: wo.assignedTo.id,
              name: `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}`,
            }
          : null,
      };
    });

    // Get monthly statistics
    const stats = {
      total: workOrders.length,
      completed: workOrders.filter((wo) => wo.status === WorkOrderStatus.COMPLETED).length,
      inProgress: workOrders.filter((wo) => wo.status === WorkOrderStatus.IN_PROGRESS).length,
      overdue: workOrders.filter((wo) => !wo.completedAt && wo.deadline && new Date() > wo.deadline).length,
      completedOnTime: workOrders.filter(
        (wo) => wo.completedAt && wo.deadline && wo.completedAt <= wo.deadline
      ).length,
      completedLate: workOrders.filter(
        (wo) => wo.completedAt && wo.deadline && wo.completedAt > wo.deadline
      ).length,
    };

    return {
      year,
      month,
      orders: calendarOrders,
      dailySummary,
      stats,
    };
  }

  async getDayDetails(date: string, workerId?: string) {
    const dayStart = startOfDay(new Date(date));
    const dayEnd = endOfDay(new Date(date));

    // Get work orders active on this day
    const workOrders = await prisma.workOrder.findMany({
      where: {
        AND: [
          { createdAt: { lte: dayEnd } },
          {
            OR: [
              { completedAt: null },
              { completedAt: { gte: dayStart } },
            ],
          },
          ...(workerId ? [{ assignedToId: workerId }] : []),
        ],
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        statusHistory: {
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    // Categorize orders
    const deadlinesToday = workOrders.filter(
      (wo) => wo.deadline && wo.deadline >= dayStart && wo.deadline <= dayEnd
    );
    const completedToday = workOrders.filter(
      (wo) => wo.completedAt && wo.completedAt >= dayStart && wo.completedAt <= dayEnd
    );
    const createdToday = workOrders.filter(
      (wo) => wo.createdAt >= dayStart && wo.createdAt <= dayEnd
    );
    const activeOnDay = workOrders.filter(
      (wo) => wo.createdAt <= dayEnd && (!wo.completedAt || wo.completedAt >= dayStart)
    );

    return {
      date,
      deadlinesToday: deadlinesToday.map((wo) => ({
        id: wo.id,
        title: wo.title,
        location: wo.location,
        priority: wo.priority,
        status: wo.status,
        deadline: wo.deadline,
        isOverdue: !wo.completedAt && wo.deadline && new Date() > wo.deadline,
        worker: wo.assignedTo
          ? { id: wo.assignedTo.id, name: `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` }
          : null,
      })),
      completedToday: completedToday.map((wo) => ({
        id: wo.id,
        title: wo.title,
        location: wo.location,
        priority: wo.priority,
        completedAt: wo.completedAt,
        wasLate: wo.completedAt && wo.deadline && wo.completedAt > wo.deadline,
        worker: wo.assignedTo
          ? { id: wo.assignedTo.id, name: `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` }
          : null,
      })),
      createdToday: createdToday.map((wo) => ({
        id: wo.id,
        title: wo.title,
        location: wo.location,
        priority: wo.priority,
        status: wo.status,
        deadline: wo.deadline,
        worker: wo.assignedTo
          ? { id: wo.assignedTo.id, name: `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` }
          : null,
      })),
      activeOnDay: activeOnDay.length,
      statusChangesToday: workOrders
        .flatMap((wo) =>
          wo.statusHistory.map((sh) => ({
            workOrderId: wo.id,
            workOrderTitle: wo.title,
            oldStatus: sh.oldStatus,
            newStatus: sh.newStatus,
            timestamp: sh.createdAt,
          }))
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    };
  }
}

export default new WorkOrderService();
