import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import notificationService from '../services/notificationService';
import { ApiResponse } from '../types';

export class NotificationController {
  async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await notificationService.getUserNotifications(req.user.id, unreadOnly);
      const unreadCount = await notificationService.getUnreadCount(req.user.id);

      const response: ApiResponse = {
        success: true,
        data: {
          notifications,
          unreadCount,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getPaginatedNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const unreadOnly = req.query.unreadOnly === 'true';
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor
        ? req.query.cursor
        : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
      const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;

      const [page, unreadCount] = await Promise.all([
        notificationService.getPaginatedUserNotifications(req.user.id, {
          cursor,
          limit,
          unreadOnly,
        }),
        notificationService.getUnreadCount(req.user.id),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          notifications: page.notifications,
          nextCursor: page.nextCursor,
          unreadCount,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const { id } = req.params;
      await notificationService.markAsRead(id, req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Notifikacija označena kao pročitana',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');

      await notificationService.markAllAsRead(req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Sve notifikacije označene kao pročitane',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
