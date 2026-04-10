import { Router, IRouter } from 'express';
import { param } from 'express-validator';
import notificationController from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router: IRouter = Router();

router.use(authenticate);

// Get notifications
router.get('/', notificationController.getNotifications.bind(notificationController));

// Paginated notifications (cursor-based) - for dashboard infinite scroll
router.get('/paginated', notificationController.getPaginatedNotifications.bind(notificationController));

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
