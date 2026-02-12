import prisma from '../config/database'
import { ApiError } from '../utils/ApiError'
import emailService from './emailService'

export interface CreateNotificationDto {
  userId: string
  type: string
  title: string
  message: string
  workOrderId?: string
  sentById?: string
  // Additional data for email notifications
  emailData?: {
    oldStatus?: string
    newStatus?: string
    note?: string
  }
}

export class NotificationService {
  async create(data: CreateNotificationDto) {
    // Create in-app notification
    const notification = await prisma.notification.create({
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
    })

    this.sendEmailNotification(data).catch((error) => {
      console.error('Failed to send email notification:', error)
    })

    return notification
  }

  private async sendEmailNotification(
    data: CreateNotificationDto,
  ): Promise<void> {
    if (!data.workOrderId) {
      return
    }

    const [user, workOrder] = await Promise.all([
      prisma.user.findUnique({
        where: { id: data.userId },
        select: { email: true, firstName: true, lastName: true },
      }),
      prisma.workOrder.findUnique({
        where: { id: data.workOrderId },
        select: {
          id: true,
          title: true,
          location: true,
          priority: true,
          deadline: true,
          status: true,
        },
      }),
    ])

    if (!user || !workOrder) {
      return
    }

    const emailData = {
      recipientEmail: user.email,
      recipientName: `${user.firstName} ${user.lastName}`,
      workOrderTitle: workOrder.title,
      workOrderId: workOrder.id,
      location: workOrder.location ?? undefined,
      priority: workOrder.priority,
      deadline: workOrder.deadline,
      status: workOrder.status,
      oldStatus: data.emailData?.oldStatus,
      newStatus: data.emailData?.newStatus,
      note: data.emailData?.note,
    }

    // Send email based on notification type
    switch (data.type) {
      case 'NEW_ASSIGNMENT':
        await emailService.sendNewAssignmentEmail(emailData)
        break
      case 'STATUS_CHANGE':
        await emailService.sendStatusChangeEmail(emailData)
        break
      default:
        // No email for other notification types
        break
    }
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    const whereClause: any = { userId }
    if (unreadOnly) {
      whereClause.isRead = false
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
    })
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  }

  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      throw ApiError.notFound('Notifikacija nije pronađena.')
    }

    if (notification.userId !== userId) {
      throw ApiError.forbidden('Nemate pristup ovoj notifikaciji.')
    }

    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    })
  }
}

export default new NotificationService()
