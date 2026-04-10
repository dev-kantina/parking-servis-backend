import prisma from '../config/database'
import { ApiError } from '../utils/ApiError'
import emailService from './emailService'
import pushSubscriptionService from './pushSubscriptionService'

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

    console.log('[NOTIFICATION] Created notification type:', data.type, 'for user:', data.userId)
    console.log('[NOTIFICATION] Triggering email send...')
    this.sendEmailNotification(data).catch((error) => {
      console.error('[NOTIFICATION] Failed to send email notification:', error)
    })

    pushSubscriptionService.sendPushToUser(data.userId, {
      title: data.title,
      message: data.message,
      url: data.workOrderId ? `/work-orders/${data.workOrderId}` : '/pregled',
    }).catch((err) => {
      console.error('[NOTIFICATION] Push failed:', err)
    })

    return notification
  }

  private async sendEmailNotification(
    data: CreateNotificationDto,
  ): Promise<void> {
    if (!data.workOrderId) {
      console.log('[NOTIFICATION] No workOrderId, skipping email')
      return
    }

    console.log('[NOTIFICATION] Fetching user and work order data for email...')
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
      console.log('[NOTIFICATION] User or work order not found, skipping email. User:', !!user, 'WorkOrder:', !!workOrder)
      return
    }
    console.log('[NOTIFICATION] Sending email to:', user.email, 'for work order:', workOrder.title)

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

  async getPaginatedUserNotifications(
    userId: string,
    options: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
  ) {
    const { cursor, unreadOnly } = options
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)

    const whereClause: any = { userId }
    if (unreadOnly) {
      whereClause.isRead = false
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        sentBy: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    const hasMore = notifications.length > limit
    const page = hasMore ? notifications.slice(0, limit) : notifications
    const nextCursor = hasMore ? page[page.length - 1].id : null

    return {
      notifications: page,
      nextCursor,
    }
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
