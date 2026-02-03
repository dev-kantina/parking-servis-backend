import prisma from '../config/database';
import { WorkOrderStatus, WorkOrderPriority, Role } from '../../generated/prisma';
import { subMonths, format, endOfMonth, subHours, startOfDay, endOfDay } from 'date-fns';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export const analyticsService = {
  async getDashboardStats(range?: DateRange) {
    const where = range ? {
      createdAt: {
        gte: range.startDate,
        lte: range.endDate,
      }
    } : {};

    const [
      totalOrders,
      activeOrders,
      completedOrders,
      ordersByStatus,
      ordersByPriority
    ] = await Promise.all([
      prisma.workOrder.count({ where }),
      prisma.workOrder.count({ 
        where: { 
          ...where,
          status: { in: [WorkOrderStatus.NEW, WorkOrderStatus.ACCEPTED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD] },
        } 
      }),
      prisma.workOrder.count({ 
        where: { 
          ...where,
          status: WorkOrderStatus.COMPLETED 
        } 
      }),
      prisma.workOrder.groupBy({
        by: ['status'],
        _count: { status: true },
        where
      }),
      prisma.workOrder.groupBy({
        by: ['priority'],
        _count: { priority: true },
        where
      })
    ]);

    // Calculate completion rate
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      completionRate,
      byStatus: ordersByStatus.reduce((acc: Record<string, number>, curr) => ({ ...acc, [curr.status]: curr._count.status }), {}),
      byPriority: ordersByPriority.reduce((acc: Record<string, number>, curr) => ({ ...acc, [curr.priority]: curr._count.priority }), {})
    };
  },

  async getWorkerPerformance(range?: DateRange) {
    const where = range ? {
      createdAt: {
        gte: range.startDate,
        lte: range.endDate,
      }
    } : {};

    const workers = await prisma.user.findMany({
      where: { role: Role.WORKER, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        assignedWorkOrders: {
            where,
            select: {
                status: true,
                completedAt: true,
                createdAt: true,
                deadline: true
            }
        },
        timeLogs: {
            where: range ? {
                startTime: {
                    gte: range.startDate,
                    lte: range.endDate
                }
            } : {},
            select: {
                duration: true
            }
        }
      }
    });

    return workers.map((worker: any) => {
      const completedOrders = worker.assignedWorkOrders.filter((wo: any) => wo.status === WorkOrderStatus.COMPLETED);
      const totalAssigned = worker.assignedWorkOrders.length;
      
      // Calculate average completion time (in hours)
      const completionTimes = completedOrders
        .filter((wo: any) => wo.completedAt)
        .map((wo: any) => (wo.completedAt!.getTime() - wo.createdAt.getTime()) / (1000 * 60 * 60));
      
      const avgCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((a: number, b: number) => a + b, 0) / completionTimes.length
        : 0;

      // Calculate on-time completion rate
      const onTimeOrders = completedOrders.filter((wo: any) => wo.completedAt && wo.completedAt <= wo.deadline);
      const onTimeRate = completedOrders.length > 0 
        ? (onTimeOrders.length / completedOrders.length) * 100 
        : 0;

      // Total logged hours
      const totalMinutesLogged = worker.timeLogs.reduce((acc: number, log: any) => acc + (log.duration || 0), 0);

      return {
        id: worker.id,
        name: `${worker.firstName} ${worker.lastName}`,
        totalAssigned,
        completedCount: completedOrders.length,
        avgCompletionTime: Math.round(avgCompletionTime * 10) / 10, // Round to 1 decimal
        onTimeRate: Math.round(onTimeRate),
        totalHoursLogged: Math.round(totalMinutesLogged / 60 * 10) / 10
      };
    }).sort((a: any, b: any) => b.completedCount - a.completedCount);
  },

  async getTrends(months: number = 6) {
    const endDate = new Date();
    const startDate = subMonths(endDate, months);

    const orders = await prisma.workOrder.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      select: {
        createdAt: true,
        status: true
      }
    });

    // Group by month
    const monthlyStats = new Map<string, { total: number; completed: number }>();

    orders.forEach((order: any) => {
      const monthKey = format(order.createdAt, 'yyyy-MM');
      const stats = monthlyStats.get(monthKey) || { total: 0, completed: 0 };
      
      stats.total++;
      if (order.status === WorkOrderStatus.COMPLETED) {
        stats.completed++;
      }
      
      monthlyStats.set(monthKey, stats);
    });

    // Fill in missing months and format for chart
    const result = [];
    let current = startDate;
    while (current <= endDate) {
      const key = format(current, 'yyyy-MM');
      const stats = monthlyStats.get(key) || { total: 0, completed: 0 };
      
      result.push({
        month: format(current, 'MMM yyyy'), // e.g., "Dec 2024"
        total: stats.total,
        completed: stats.completed
      });
      
      current = endOfMonth(current);
      current.setDate(current.getDate() + 1); // Move to start of next month
    }

    return result;
  },

  async getLiveStatus() {
    const now = new Date();
    const oneHourAgo = subHours(now, 1);
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // Get work orders in progress with assigned worker details
    const inProgressOrders = await prisma.workOrder.findMany({
      where: {
        status: WorkOrderStatus.IN_PROGRESS,
      },
      select: {
        id: true,
        title: true,
        location: true,
        priority: true,
        deadline: true,
        updatedAt: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get all active orders count by status (excluding completed, cancelled, declined)
    const ordersByStatus = await prisma.workOrder.groupBy({
      by: ['status'],
      _count: { status: true },
      where: {
        status: {
          notIn: [
            WorkOrderStatus.COMPLETED,
            WorkOrderStatus.CANCELLED,
            WorkOrderStatus.DECLINED,
          ],
        },
      },
    });

    // Get urgent/high priority active orders
    const urgentOrders = await prisma.workOrder.findMany({
      where: {
        priority: { in: [WorkOrderPriority.URGENT, WorkOrderPriority.HIGH] },
        status: {
          notIn: [
            WorkOrderStatus.COMPLETED,
            WorkOrderStatus.CANCELLED,
            WorkOrderStatus.DECLINED,
          ],
        },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        location: true,
        deadline: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      take: 10,
    });

    // Get overdue orders
    const overdueOrders = await prisma.workOrder.findMany({
      where: {
        deadline: { lt: now },
        status: {
          notIn: [
            WorkOrderStatus.COMPLETED,
            WorkOrderStatus.CANCELLED,
            WorkOrderStatus.DECLINED,
          ],
        },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        location: true,
        deadline: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { deadline: 'asc' },
    });

    // Get workers scheduled for today
    const workersOnDuty = await prisma.scheduleEntry.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        user: { isActive: true },
        shift: { isActive: true },
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            assignedWorkOrders: {
              where: {
                status: WorkOrderStatus.IN_PROGRESS,
              },
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        shift: {
          select: {
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // Get recent activity (status changes in the last hour)
    const recentActivity = await prisma.workOrderStatusHistory.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
      },
      select: {
        id: true,
        oldStatus: true,
        newStatus: true,
        createdAt: true,
        workOrder: {
          select: {
            id: true,
            title: true,
            assignedTo: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get today's stats
    const todayStats = await prisma.workOrder.groupBy({
      by: ['status'],
      _count: { status: true },
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const todayCompleted = await prisma.workOrder.count({
      where: {
        completedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // Format response
    const statusCounts = ordersByStatus.reduce(
      (acc: Record<string, number>, curr) => ({
        ...acc,
        [curr.status]: curr._count.status,
      }),
      {
        NEW: 0,
        ACCEPTED: 0,
        IN_PROGRESS: 0,
        ON_HOLD: 0,
      }
    );

    const todayCreated = todayStats.reduce((sum, s) => sum + s._count.status, 0);

    return {
      summary: {
        inProgress: statusCounts.IN_PROGRESS,
        new: statusCounts.NEW,
        accepted: statusCounts.ACCEPTED,
        onHold: statusCounts.ON_HOLD,
        totalActive:
          statusCounts.NEW +
          statusCounts.ACCEPTED +
          statusCounts.IN_PROGRESS +
          statusCounts.ON_HOLD,
        urgent: urgentOrders.filter((o) => o.priority === WorkOrderPriority.URGENT).length,
        overdue: overdueOrders.length,
        todayCreated,
        todayCompleted,
      },
      inProgressOrders: inProgressOrders.map((order) => ({
        id: order.id,
        title: order.title,
        location: order.location,
        priority: order.priority,
        deadline: order.deadline,
        lastUpdated: order.updatedAt,
        worker: order.assignedTo
          ? {
              id: order.assignedTo.id,
              name: `${order.assignedTo.firstName} ${order.assignedTo.lastName}`,
              phone: order.assignedTo.phone,
            }
          : null,
      })),
      urgentOrders: urgentOrders.map((order) => ({
        id: order.id,
        title: order.title,
        priority: order.priority,
        status: order.status,
        location: order.location,
        deadline: order.deadline,
        worker: order.assignedTo
          ? {
              id: order.assignedTo.id,
              name: `${order.assignedTo.firstName} ${order.assignedTo.lastName}`,
            }
          : null,
      })),
      overdueOrders: overdueOrders.map((order) => ({
        id: order.id,
        title: order.title,
        priority: order.priority,
        status: order.status,
        location: order.location,
        deadline: order.deadline,
        worker: order.assignedTo
          ? {
              id: order.assignedTo.id,
              name: `${order.assignedTo.firstName} ${order.assignedTo.lastName}`,
            }
          : null,
      })),
      workersOnDuty: workersOnDuty.map((entry) => ({
        id: entry.user.id,
        name: `${entry.user.firstName} ${entry.user.lastName}`,
        phone: entry.user.phone,
        shift: entry.shift,
        currentTasks: entry.user.assignedWorkOrders,
      })),
      recentActivity: recentActivity.map((activity) => ({
        id: activity.id,
        timestamp: activity.createdAt,
        oldStatus: activity.oldStatus,
        newStatus: activity.newStatus,
        workOrder: {
          id: activity.workOrder.id,
          title: activity.workOrder.title,
        },
        worker: activity.workOrder.assignedTo
          ? `${activity.workOrder.assignedTo.firstName} ${activity.workOrder.assignedTo.lastName}`
          : null,
      })),
      timestamp: now.toISOString(),
    };
  },
};
