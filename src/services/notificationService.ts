import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';

export interface CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  message: string;
  workOrderId?: string;
  sentById?: string;
}

export class NotificationService {
  async create(data: CreateNotificationDto) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        workOrderId: data.workOrderId,
        sentById: data.sentById,
        isRead: false,
      },
      include: {
        sentBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    const whereClause: any = { userId };
    if (unreadOnly) {
      whereClause.isRead = false;
    }

    return prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50
      include: {
        sentBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw ApiError.notFound('Notifikacija nije pronađena.');
    }

    if (notification.userId !== userId) {
      throw ApiError.forbidden('Nemate pristup ovoj notifikaciji.');
    }

    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }
}

export default new NotificationService();
