import { Router, IRouter } from 'express';
import { param, body } from 'express-validator';
import scheduleController from '../controllers/scheduleController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Role, DayOfWeek } from '../../generated/prisma';

const router: IRouter = Router();

// All requests must be authenticated
router.use(authenticate);

// GET /api/schedules/matrix - Get schedule matrix (all workers with their weekly schedules)
router.get(
  '/matrix',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  scheduleController.getScheduleMatrix.bind(scheduleController)
);

// GET /api/schedules - List all schedules
router.get(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  scheduleController.getAll.bind(scheduleController)
);

// GET /api/schedules/user/:userId - Get schedules for a specific user
router.get(
  '/user/:userId',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    param('userId').isUUID().withMessage('ID korisnika mora biti validan UUID'),
    validate,
  ],
  scheduleController.getByUserId.bind(scheduleController)
);

// POST /api/schedules - Set a schedule entry (create or update)
router.post(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    body('userId')
      .notEmpty()
      .withMessage('ID korisnika je obavezan')
      .isUUID()
      .withMessage('ID korisnika mora biti validan UUID'),
    body('dayOfWeek')
      .notEmpty()
      .withMessage('Dan u sedmici je obavezan')
      .isIn(Object.values(DayOfWeek))
      .withMessage('Nevažeći dan u sedmici'),
    body('shiftId')
      .notEmpty()
      .withMessage('ID smjene je obavezan')
      .isUUID()
      .withMessage('ID smjene mora biti validan UUID'),
    validate,
  ],
  scheduleController.setScheduleEntry.bind(scheduleController)
);

// PUT /api/schedules/user/:userId - Bulk update user's weekly schedule
router.put(
  '/user/:userId',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    param('userId').isUUID().withMessage('ID korisnika mora biti validan UUID'),
    body('schedule')
      .isArray()
      .withMessage('Raspored mora biti niz'),
    body('schedule.*.dayOfWeek')
      .isIn(Object.values(DayOfWeek))
      .withMessage('Nevažeći dan u sedmici'),
    body('schedule.*.shiftId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('ID smjene mora biti validan UUID'),
    validate,
  ],
  scheduleController.bulkUpdateUserSchedule.bind(scheduleController)
);

// DELETE /api/schedules/:id - Delete a specific schedule entry
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  scheduleController.deleteScheduleEntry.bind(scheduleController)
);

// DELETE /api/schedules/user/:userId/:dayOfWeek - Delete schedule for user on specific day
router.delete(
  '/user/:userId/:dayOfWeek',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    param('userId').isUUID().withMessage('ID korisnika mora biti validan UUID'),
    param('dayOfWeek')
      .isIn(Object.values(DayOfWeek))
      .withMessage('Nevažeći dan u sedmici'),
    validate,
  ],
  scheduleController.deleteUserDaySchedule.bind(scheduleController)
);

// ========================================
// DATE-SPECIFIC SCHEDULE ENTRY ROUTES
// ========================================

// GET /api/schedules/entries - Get schedule entries by date range
router.get(
  '/entries',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  scheduleController.getEntriesByDateRange.bind(scheduleController)
);

// GET /api/schedules/calendar - Get calendar view for a date range
router.get(
  '/calendar',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  scheduleController.getCalendarView.bind(scheduleController)
);

// GET /api/schedules/available - Get workers available on a specific date
router.get(
  '/available',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  scheduleController.getWorkersAvailableOnDate.bind(scheduleController)
);

// POST /api/schedules/entries - Set a date-specific schedule entry
router.post(
  '/entries',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    body('userId')
      .notEmpty()
      .withMessage('ID korisnika je obavezan')
      .isUUID()
      .withMessage('ID korisnika mora biti validan UUID'),
    body('date')
      .notEmpty()
      .withMessage('Datum je obavezan')
      .isISO8601()
      .withMessage('Datum mora biti u ISO 8601 formatu'),
    body('shiftId')
      .notEmpty()
      .withMessage('ID smjene je obavezan')
      .isUUID()
      .withMessage('ID smjene mora biti validan UUID'),
    body('note')
      .optional()
      .isString()
      .withMessage('Napomena mora biti string'),
    validate,
  ],
  scheduleController.setDateEntry.bind(scheduleController)
);

// POST /api/schedules/generate - Generate schedule entries from weekly template
router.post(
  '/generate',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    body('startDate')
      .notEmpty()
      .withMessage('Početni datum je obavezan')
      .isISO8601()
      .withMessage('Početni datum mora biti u ISO 8601 formatu'),
    body('endDate')
      .notEmpty()
      .withMessage('Krajnji datum je obavezan')
      .isISO8601()
      .withMessage('Krajnji datum mora biti u ISO 8601 formatu'),
    body('userIds')
      .optional()
      .isArray()
      .withMessage('userIds mora biti niz'),
    body('userIds.*')
      .optional()
      .isUUID()
      .withMessage('Svaki userId mora biti validan UUID'),
    validate,
  ],
  scheduleController.generateFromTemplate.bind(scheduleController)
);

// DELETE /api/schedules/entries/:userId/:date - Delete a date-specific schedule entry
router.delete(
  '/entries/:userId/:date',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    param('userId').isUUID().withMessage('ID korisnika mora biti validan UUID'),
    param('date').isISO8601().withMessage('Datum mora biti u ISO 8601 formatu'),
    validate,
  ],
  scheduleController.deleteDateEntry.bind(scheduleController)
);

export default router;
