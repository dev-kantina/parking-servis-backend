import prisma from '../config/database';
import { WorkOrderStatus, Role } from '../../generated/prisma';
import { subMonths, format, endOfMonth } from 'date-fns';

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
          status: { in: [WorkOrderStatus.NEW, WorkOrderStatus.ACCEPTED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD] } 
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
  }
};
