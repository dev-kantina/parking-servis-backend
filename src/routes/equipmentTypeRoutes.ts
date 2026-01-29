import { Router, IRouter } from 'express';
import { param, body } from 'express-validator';
import equipmentTypeController from '../controllers/equipmentTypeController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Role } from '../../generated/prisma';

const router: IRouter = Router();

// All requests must be authenticated
router.use(authenticate);

// GET /api/equipment-types - List all equipment types
router.get(
  '/',
  equipmentTypeController.getAll.bind(equipmentTypeController)
);

// GET /api/equipment-types/:id - Get equipment type details
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  equipmentTypeController.getById.bind(equipmentTypeController)
);

// POST /api/equipment-types - Create new equipment type (Admin only)
router.post(
  '/',
  authorize(Role.ADMINISTRATOR),
  [
    body('name')
      .notEmpty()
      .withMessage('Naziv tipa opreme je obavezan')
      .isLength({ max: 100 })
      .withMessage('Naziv tipa opreme može imati najviše 100 karaktera'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Opis može imati najviše 500 karaktera'),
    validate,
  ],
  equipmentTypeController.create.bind(equipmentTypeController)
);

// PUT /api/equipment-types/:id - Update equipment type (Admin only)
router.put(
  '/:id',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Naziv tipa opreme može imati najviše 100 karaktera'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Opis može imati najviše 500 karaktera'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive mora biti boolean'),
    validate,
  ],
  equipmentTypeController.update.bind(equipmentTypeController)
);

// DELETE /api/equipment-types/:id - Delete (deactivate) equipment type (Admin only)
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  equipmentTypeController.delete.bind(equipmentTypeController)
);

// PATCH /api/equipment-types/:id/status - Activate/deactivate equipment type (Admin only)
router.patch(
  '/:id/status',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('isActive').isBoolean().withMessage('isActive mora biti boolean'),
    validate,
  ],
  equipmentTypeController.updateStatus.bind(equipmentTypeController)
);

export default router;
