import { Router, IRouter } from 'express';
import { param, body } from 'express-validator';
import shiftController from '../controllers/shiftController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Role } from '../../generated/prisma';

const router: IRouter = Router();

// All requests must be authenticated
router.use(authenticate);

// GET /api/shifts - List all shifts
router.get(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  shiftController.getAll.bind(shiftController)
);

// GET /api/shifts/:id - Get shift details
router.get(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  shiftController.getById.bind(shiftController)
);

// POST /api/shifts - Create new shift
router.post(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('name')
      .notEmpty()
      .withMessage('Naziv smjene je obavezan')
      .isLength({ max: 100 })
      .withMessage('Naziv smjene može imati najviše 100 karaktera'),
    body('startTime')
      .notEmpty()
      .withMessage('Početno vrijeme je obavezno')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Početno vrijeme mora biti u formatu HH:MM'),
    body('endTime')
      .notEmpty()
      .withMessage('Završno vrijeme je obavezno')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Završno vrijeme mora biti u formatu HH:MM'),
    validate,
  ],
  shiftController.create.bind(shiftController)
);

// PUT /api/shifts/:id - Update shift
router.put(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Naziv smjene može imati najviše 100 karaktera'),
    body('startTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Početno vrijeme mora biti u formatu HH:MM'),
    body('endTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Završno vrijeme mora biti u formatu HH:MM'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive mora biti boolean'),
    validate,
  ],
  shiftController.update.bind(shiftController)
);

// DELETE /api/shifts/:id - Delete (deactivate) shift
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  shiftController.delete.bind(shiftController)
);

// PATCH /api/shifts/:id/status - Activate/deactivate shift
router.patch(
  '/:id/status',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('isActive').isBoolean().withMessage('isActive mora biti boolean'),
    validate,
  ],
  shiftController.updateStatus.bind(shiftController)
);

export default router;
