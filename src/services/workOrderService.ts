import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import notificationService from './notificationService';
import { WorkOrderStatus, WorkOrderPriority, Role } from '../../generated/prisma';

export interface CreateWorkOrderDto {
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  deadline: Date;
  resources?: string;
  assignedToId?: string;
}

export interface UpdateWorkOrderDto {
  title?: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  priority?: WorkOrderPriority;
  deadline?: Date;
  resources?: string;
  assignedToId?: string | null;
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assignedToId?: string;
  createdById?: string;
  search?: string;
  deadlineBefore?: Date;
  deadlineAfter?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

// Definisanje validnih prelaza statusa
const STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.NEW]: [WorkOrderStatus.ACCEPTED],
  [WorkOrderStatus.ACCEPTED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.NEW],
  [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.ON_HOLD, WorkOrderStatus.COMPLETED],
  [WorkOrderStatus.ON_HOLD]: [WorkOrderStatus.IN_PROGRESS],
  [WorkOrderStatus.COMPLETED]: [], // Završen nalog se ne može promijeniti
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

    const workOrder = await prisma.workOrder.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        priority: data.priority || WorkOrderPriority.MEDIUM,
        deadline: new Date(data.deadline),
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

    // Završeni nalozi se ne mogu uređivati
    if (currentWorkOrder.status === WorkOrderStatus.COMPLETED) {
      throw ApiError.badRequest('Završeni nalozi se ne mogu uređivati');
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

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.location && { location: data.location }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.priority && { priority: data.priority }),
        ...(data.deadline && { deadline: new Date(data.deadline) }),
        ...(data.resources !== undefined && { resources: data.resources }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
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

    // Provjera validnog prelaza statusa
    const allowedTransitions = STATUS_TRANSITIONS[workOrder.status];
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
        message: `Status naloga "${updatedWorkOrder.title}" je promijenjen u ${newStatus}.`,
        workOrderId: updatedWorkOrder.id,
        sentById: userId,
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
            notIn: [WorkOrderStatus.COMPLETED],
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
}

export default new WorkOrderService();
