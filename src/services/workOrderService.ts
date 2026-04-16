import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import notificationService from './notificationService';
import { WorkOrderStatus, WorkOrderPriority, Role } from '../../generated/prisma';
import { getBusinessMonthBounds, getBusinessDayBounds, formatBusinessDate, eachDayInRange } from '../utils/timezone';
import { STATUS_LABELS } from '../constants';

export interface WorkOrderEquipmentInput {
  equipmentId: string;
  quantity: number;
}

export interface CreateWorkOrderDto {
  title: string;
  description: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  scheduledDate?: Date;
  deadline?: Date;
  resources?: string;
  assignedToIds?: string[];
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
  assignedToIds?: string[];
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
  scheduledDate?: string; // exact day filter (YYYY-MM-DD)
  deadlineBefore?: Date;
  deadlineAfter?: Date;
  workOrderType?: 'all' | 'standard' | 'regular';
  shiftId?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

const assignmentsInclude = {
  assignments: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
};

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
  if (role === Role.ADMINISTRATOR || role === Role.MANAGER || role === Role.TECHNICAL_SUPPORT) {
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
      where.assignments = { some: { userId: filters.assignedToId } };
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

    // Exact day filter - filters work orders active on a specific day
    if (filters.scheduledDate) {
      const { start: dayStart, end: dayEnd } = getBusinessDayBounds(filters.scheduledDate);
      where.AND = [
        ...(where.AND || []),
        { createdAt: { lte: dayEnd } },
        {
          OR: [
            { completedAt: null },
            { completedAt: { gte: dayStart } },
          ],
        },
      ];
    }

    // Shift filter - find workers on a specific shift and filter by them
    if (filters.shiftId) {
      const targetDate = filters.scheduledDate || formatBusinessDate(new Date());
      const scheduleEntries = await prisma.scheduleEntry.findMany({
        where: {
          shiftId: filters.shiftId,
          date: new Date(targetDate),
        },
        select: { userId: true },
      });
      const workerIds = scheduleEntries.map((e) => e.userId);
      if (workerIds.length > 0) {
        if (filters.assignedToId) {
          // Already filtered by assignedToId via assignments.some, intersect with shift workers
          where.assignments = {
            some: {
              userId: { in: workerIds.includes(filters.assignedToId) ? [filters.assignedToId] : [] },
            },
          };
        } else {
          where.assignments = { some: { userId: { in: workerIds } } };
        }
      } else {
        // No workers on this shift - return empty results
        where.assignments = { some: { userId: { in: [] } } };
      }
    }

    if (filters.workOrderType === 'standard') {
      where.standardId = { not: null };
    } else if (filters.workOrderType === 'regular') {
      where.standardId = null;
    }

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { scheduledDate: { sort: 'desc', nulls: 'last' } },
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
          ...assignmentsInclude,
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
        ...assignmentsInclude,
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
    // Validate assigned users
    if (data.assignedToIds && data.assignedToIds.length > 0) {
      const assignedUsers = await prisma.user.findMany({
        where: { id: { in: data.assignedToIds } },
      });

      if (assignedUsers.length !== data.assignedToIds.length) {
        throw ApiError.badRequest('Neki od dodijeljenih korisnika nisu pronađeni');
      }

      const inactiveUser = assignedUsers.find(u => !u.isActive);
      if (inactiveUser) {
        throw ApiError.badRequest(`Korisnik ${inactiveUser.firstName} ${inactiveUser.lastName} nije aktivan`);
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
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: WorkOrderStatus.NEW,
            note: 'Radni nalog kreiran',
          },
        },
        ...(data.assignedToIds && data.assignedToIds.length > 0 && {
          assignments: {
            create: data.assignedToIds.map(userId => ({ userId })),
          },
        }),
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
        ...assignmentsInclude,
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

    // Send notifications to all assigned users
    if (data.assignedToIds && data.assignedToIds.length > 0) {
      for (const assignedUserId of data.assignedToIds) {
        await notificationService.create({
          userId: assignedUserId,
          type: 'NEW_ASSIGNMENT',
          title: 'Novi radni nalog',
          message: `Dodijeljen vam je novi radni nalog: ${workOrder.title}`,
          workOrderId: workOrder.id,
          sentById: createdById,
        });
      }
    }

    return workOrder;
  }

  async update(id: string, data: UpdateWorkOrderDto, userId: string, userRole: Role) {
    const currentWorkOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        assignments: { select: { userId: true } },
      },
    });

    if (!currentWorkOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    const currentAssignedIds = currentWorkOrder.assignments.map(a => a.userId);

    // Radnik može ažurirati samo naloge koji su mu dodijeljeni
    if (userRole === Role.WORKER && !currentAssignedIds.includes(userId)) {
      throw ApiError.forbidden('Nemate dozvolu za uređivanje ovog naloga');
    }

    // Završeni, otkazani i odbijeni nalozi se ne mogu uređivati
    if (([WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED, WorkOrderStatus.DECLINED] as WorkOrderStatus[]).includes(currentWorkOrder.status)) {
      throw ApiError.badRequest('Završeni, otkazani ili odbijeni nalozi se ne mogu uređivati');
    }

    // Validate new assigned users
    if (data.assignedToIds && data.assignedToIds.length > 0) {
      const assignedUsers = await prisma.user.findMany({
        where: { id: { in: data.assignedToIds } },
      });

      if (assignedUsers.length !== data.assignedToIds.length) {
        throw ApiError.badRequest('Neki od dodijeljenih korisnika nisu pronađeni');
      }

      const inactiveUser = assignedUsers.find(u => !u.isActive);
      if (inactiveUser) {
        throw ApiError.badRequest(`Korisnik ${inactiveUser.firstName} ${inactiveUser.lastName} nije aktivan`);
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

    // Handle assignments update with delete-and-recreate pattern
    if (data.assignedToIds !== undefined) {
      await prisma.workOrderAssignment.deleteMany({
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
        ...(data.assignedToIds !== undefined && data.assignedToIds.length > 0 && {
          assignments: {
            create: data.assignedToIds.map(uid => ({ userId: uid })),
          },
        }),
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
        ...assignmentsInclude,
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

    // Notify only newly added users
    if (data.assignedToIds) {
      const newlyAssigned = data.assignedToIds.filter(uid => !currentAssignedIds.includes(uid));
      for (const newUserId of newlyAssigned) {
        await notificationService.create({
          userId: newUserId,
          type: 'NEW_ASSIGNMENT',
          title: 'Novi radni nalog',
          message: `Dodijeljen vam je novi radni nalog: ${updatedWorkOrder.title}`,
          workOrderId: updatedWorkOrder.id,
          sentById: userId,
        });
      }
    }

    return updatedWorkOrder;
  }

  async updateStatus(id: string, newStatus: WorkOrderStatus, userId: string, userRole: Role, note?: string) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        assignments: { select: { userId: true } },
      },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    // Radnik može mijenjati status samo naloga koji su mu dodijeljeni
    const assignedUserIds = workOrder.assignments.map(a => a.userId);
    if (userRole === Role.WORKER && !assignedUserIds.includes(userId)) {
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
        ...assignmentsInclude,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Notify the creator if they didn't make the change
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

    // Notify all TECHNICAL_SUPPORT users (except the one who made the change and the creator who was already notified)
    const technicalSupportUsers = await prisma.user.findMany({
      where: {
        role: Role.TECHNICAL_SUPPORT,
        isActive: true,
        id: {
          notIn: [userId, updatedWorkOrder.createdById].filter(Boolean) as string[],
        },
      },
      select: { id: true },
    });

    for (const tsUser of technicalSupportUsers) {
      notificationService.create({
        userId: tsUser.id,
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
      }).catch((err) => {
        console.error('[WORK_ORDER] Failed to notify technical support user:', tsUser.id, err);
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
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {
      assignments: { some: { userId } },
    };

    if (filters.status) {
      where.status = filters.status;
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

    if (filters.scheduledDateBefore) {
      where.scheduledDate = { ...where.scheduledDate, lte: filters.scheduledDateBefore };
    }

    if (filters.scheduledDateAfter) {
      where.scheduledDate = { ...where.scheduledDate, gte: filters.scheduledDateAfter };
    }

    if (filters.scheduledDate) {
      const { start: dayStart, end: dayEnd } = getBusinessDayBounds(filters.scheduledDate);
      where.AND = [
        ...(where.AND || []),
        { createdAt: { lte: dayEnd } },
        {
          OR: [
            { completedAt: null },
            { completedAt: { gte: dayStart } },
          ],
        },
      ];
    }

    if (filters.workOrderType === 'standard') {
      where.standardId = { not: null };
    } else if (filters.workOrderType === 'regular') {
      where.standardId = null;
    }

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { completedAt: { sort: 'asc', nulls: 'first' } },
          { priority: 'desc' },
          { deadline: 'asc' },
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
          ...assignmentsInclude,
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
          ...assignmentsInclude,
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

  async getCalendarData(year: number, month: number, workerId?: string, workOrderType?: 'all' | 'standard' | 'regular') {
    const { start: monthStart, end: monthEnd } = getBusinessMonthBounds(year, month);

    const workOrderTypeFilter = workOrderType === 'standard'
      ? [{ standardId: { not: null } }]
      : workOrderType === 'regular'
        ? [{ standardId: null }]
        : [];

    const workOrders = await prisma.workOrder.findMany({
      where: {
        AND: [
          { createdAt: { lte: monthEnd } },
          {
            OR: [
              { completedAt: null },
              { completedAt: { gte: monthStart } },
            ],
          },
          // Optional worker filter
          ...(workerId ? [{ assignments: { some: { userId: workerId } } }] : []),
          // Optional work order type filter
          ...workOrderTypeFilter,
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
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dailySummary[dateKey] = {
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        deadlines: 0,
      };
    }

    // Process each work order
    workOrders.forEach((wo) => {
      const deadlineDate = wo.deadline ? formatBusinessDate(wo.deadline) : null;
      const completedDate = wo.completedAt ? formatBusinessDate(wo.completedAt) : null;

      if (deadlineDate && dailySummary[deadlineDate]) {
        dailySummary[deadlineDate].deadlines++;
      }

      if (completedDate && dailySummary[completedDate]) {
        dailySummary[completedDate].completed++;
      }

      const orderStartDate = formatBusinessDate(
        new Date(Math.max(wo.createdAt.getTime(), monthStart.getTime()))
      );
      const orderEndDate = formatBusinessDate(
        wo.completedAt
          ? new Date(Math.min(wo.completedAt.getTime(), monthEnd.getTime()))
          : monthEnd
      );

      const dayKeys = eachDayInRange(orderStartDate, orderEndDate);
      for (const dateKey of dayKeys) {
        if (dailySummary[dateKey]) {
          dailySummary[dateKey].total++;

          if (wo.status === WorkOrderStatus.IN_PROGRESS) {
            dailySummary[dateKey].inProgress++;
          }

          if (!wo.completedAt && deadlineDate && dateKey > deadlineDate) {
            dailySummary[dateKey].overdue++;
          }
        }
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
        workers: wo.assignments.map(a => ({
          id: a.user.id,
          name: `${a.user.firstName} ${a.user.lastName}`,
        })),
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

  async getDayDetails(date: string, workerId?: string, workOrderType?: 'all' | 'standard' | 'regular') {
    const { start: dayStart, end: dayEnd } = getBusinessDayBounds(date);

    const workOrderTypeFilter = workOrderType === 'standard'
      ? [{ standardId: { not: null } }]
      : workOrderType === 'regular'
        ? [{ standardId: null }]
        : [];

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
          ...(workerId ? [{ assignments: { some: { userId: workerId } } }] : []),
          ...workOrderTypeFilter,
        ],
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
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
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    const mapWorkers = (wo: typeof workOrders[0]) =>
      wo.assignments.map(a => ({
        id: a.user.id,
        name: `${a.user.firstName} ${a.user.lastName}`,
      }));

    const mapComments = (wo: typeof workOrders[0]) =>
      wo.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        user: c.user ? { id: c.user.id, name: `${c.user.firstName} ${c.user.lastName}` } : null,
      }));

    const mapAttachments = (wo: typeof workOrders[0]) =>
      wo.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        uploadedAt: a.uploadedAt,
      }));

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
        workers: mapWorkers(wo),
        comments: mapComments(wo),
        attachments: mapAttachments(wo),
      })),
      completedToday: completedToday.map((wo) => ({
        id: wo.id,
        title: wo.title,
        location: wo.location,
        priority: wo.priority,
        completedAt: wo.completedAt,
        wasLate: wo.completedAt && wo.deadline && wo.completedAt > wo.deadline,
        workers: mapWorkers(wo),
        comments: mapComments(wo),
        attachments: mapAttachments(wo),
      })),
      createdToday: createdToday.map((wo) => ({
        id: wo.id,
        title: wo.title,
        location: wo.location,
        priority: wo.priority,
        status: wo.status,
        deadline: wo.deadline,
        workers: mapWorkers(wo),
        comments: mapComments(wo),
        attachments: mapAttachments(wo),
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
  async getActiveByUserAndDate(userId: string, date: string) {
    const { start: dayStart, end: dayEnd } = getBusinessDayBounds(date);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        assignments: { some: { userId } },
        scheduledDate: { gte: dayStart, lte: dayEnd },
        status: {
          in: [
            WorkOrderStatus.NEW,
            WorkOrderStatus.ACCEPTED,
            WorkOrderStatus.IN_PROGRESS,
            WorkOrderStatus.ON_HOLD,
          ],
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
        ...assignmentsInclude,
      },
      orderBy: [
        { priority: 'desc' },
        { deadline: 'asc' },
      ],
    });

    return workOrders;
  }

  async reassignWorkOrders(
    reassignments: { workOrderId: string; fromUserId: string; toUserId: string }[],
    performedByUserId: string,
  ) {
    const results = [];

    for (const { workOrderId, fromUserId, toUserId } of reassignments) {
      const workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          assignments: { select: { userId: true } },
        },
      });

      if (!workOrder) {
        throw ApiError.notFound(`Radni nalog ${workOrderId} nije pronađen`);
      }

      const isAssigned = workOrder.assignments.some(a => a.userId === fromUserId);
      if (!isAssigned) {
        throw ApiError.badRequest(`Korisnik nije dodijeljen radnom nalogu: ${workOrder.title}`);
      }

      const toUser = await prisma.user.findUnique({ where: { id: toUserId } });
      if (!toUser || !toUser.isActive) {
        throw ApiError.badRequest('Ciljni korisnik nije pronađen ili nije aktivan');
      }

      const alreadyAssigned = workOrder.assignments.some(a => a.userId === toUserId);

      await prisma.$transaction(async (tx) => {
        await tx.workOrderAssignment.deleteMany({
          where: { workOrderId, userId: fromUserId },
        });

        if (!alreadyAssigned) {
          await tx.workOrderAssignment.create({
            data: { workOrderId, userId: toUserId },
          });
        }
      });

      await notificationService.create({
        userId: toUserId,
        type: 'NEW_ASSIGNMENT',
        title: 'Preraspoređen radni nalog',
        message: `Dodijeljen vam je radni nalog: ${workOrder.title}`,
        workOrderId,
        sentById: performedByUserId,
      });

      const updated = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          ...assignmentsInclude,
        },
      });

      results.push(updated);
    }

    return results;
  }
}

export default new WorkOrderService();
