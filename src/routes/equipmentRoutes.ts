import { Router, IRouter } from 'express';
import { param, body } from 'express-validator';
import equipmentController from '../controllers/equipmentController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Role } from '../../generated/prisma';

const router: IRouter = Router();

// All requests must be authenticated
router.use(authenticate);

// GET /api/equipment/available - Get equipment grouped by type for work order selection
router.get(
  '/available',
  equipmentController.getAvailableForWorkOrder.bind(equipmentController)
);

// GET /api/equipment - List all equipment
router.get('/', equipmentController.getAll.bind(equipmentController));

// GET /api/equipment/:id - Get equipment details
router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  equipmentController.getById.bind(equipmentController)
);

// POST /api/equipment - Create new equipment (Admin/Manager)
router.post(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('name')
      .notEmpty()
      .withMessage('Naziv opreme je obavezan')
      .isLength({ max: 200 })
      .withMessage('Naziv opreme može imati najviše 200 karaktera'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Opis može imati najviše 1000 karaktera'),
    body('typeId').notEmpty().isUUID().withMessage('Tip opreme je obavezan i mora biti validan UUID'),
    body('quantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Količina ne može biti negativan broj'),
    validate,
  ],
  equipmentController.create.bind(equipmentController)
);

// PUT /api/equipment/:id - Update equipment (Admin/Manager)
router.put(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('name')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Naziv opreme može imati najviše 200 karaktera'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Opis može imati najviše 1000 karaktera'),
    body('typeId').optional().isUUID().withMessage('Tip opreme mora biti validan UUID'),
    body('quantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Količina ne može biti negativan broj'),
    body('isActive').optional().isBoolean().withMessage('isActive mora biti boolean'),
    validate,
  ],
  equipmentController.update.bind(equipmentController)
);

// DELETE /api/equipment/:id - Delete (deactivate) equipment (Admin/Manager)
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  equipmentController.delete.bind(equipmentController)
);

// PATCH /api/equipment/:id/status - Activate/deactivate equipment (Admin/Manager)
router.patch(
  '/:id/status',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('isActive').isBoolean().withMessage('isActive mora biti boolean'),
    validate,
  ],
  equipmentController.updateStatus.bind(equipmentController)
);

// PATCH /api/equipment/:id/quantity - Update quantity only (any authenticated except call center)
router.patch(
  '/:id/quantity',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT, Role.WORKER),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('quantity')
      .isInt({ min: 0 })
      .withMessage('Količina ne može biti negativan broj'),
    validate,
  ],
  equipmentController.updateQuantity.bind(equipmentController)
);

// GET /api/equipment/:id/quantity-history - View quantity audit log
router.get(
  '/:id/quantity-history',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT, Role.WORKER),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  equipmentController.getQuantityHistory.bind(equipmentController)
);

export default router;
