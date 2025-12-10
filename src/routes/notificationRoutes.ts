import { Router, IRouter } from 'express';
import { param } from 'express-validator';
import notificationController from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router: IRouter = Router();

router.use(authenticate);

// Get notifications
router.get('/', notificationController.getNotifications.bind(notificationController));

// Mark all as read
router.patch('/read-all', notificationController.markAllAsRead.bind(notificationController));

// Mark single as read
router.patch(
  '/:id/read',
  [
    param('id').isUUID().withMessage('Invalid ID'),
    validate,
  ],
  notificationController.markAsRead.bind(notificationController)
);

export default router;
