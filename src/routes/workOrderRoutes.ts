import { Router, IRouter } from 'express';
import { body, param, query } from 'express-validator';
import workOrderController from '../controllers/workOrderController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Role } from '../../generated/prisma';

const router: IRouter = Router();

// Svi zahtjevi moraju biti autentifikovani
router.use(authenticate);

// GET /api/work-orders/stats - Statistike (samo za menadžere i administratore)
router.get(
  '/stats',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  workOrderController.getStats.bind(workOrderController)
);

// GET /api/work-orders/my - Moji nalozi (za radnike)
router.get(
  '/my',
  workOrderController.getMyOrders.bind(workOrderController)
);

// GET /api/work-orders - Lista svih naloga
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Stranica mora biti pozitivan broj'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit mora biti između 1 i 100'),
    query('status').optional().isString(),
    query('priority').optional().isString(),
    validate,
  ],
  workOrderController.getAll.bind(workOrderController)
);

// GET /api/work-orders/:id - Detalji naloga
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  workOrderController.getById.bind(workOrderController)
);

// POST /api/work-orders - Kreiranje naloga (samo menadžeri i administratori)
router.post(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    body('title')
      .notEmpty()
      .withMessage('Naslov je obavezan')
      .isLength({ min: 3, max: 200 })
      .withMessage('Naslov mora imati između 3 i 200 karaktera'),
    body('description')
      .notEmpty()
      .withMessage('Opis je obavezan')
      .isLength({ min: 10 })
      .withMessage('Opis mora imati najmanje 10 karaktera'),
    body('location')
      .notEmpty()
      .withMessage('Lokacija je obavezna'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Geografska širina mora biti između -90 i 90'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Geografska dužina mora biti između -180 i 180'),
    body('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
      .withMessage('Prioritet mora biti LOW, MEDIUM, HIGH ili URGENT'),
    body('deadline')
      .notEmpty()
      .withMessage('Rok izvršenja je obavezan')
      .isISO8601()
      .withMessage('Nevažeći format datuma'),
    body('resources')
      .optional()
      .isString(),
    body('assignedToId')
      .optional()
      .isUUID()
      .withMessage('ID dodijeljenog korisnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.create.bind(workOrderController)
);

// PUT /api/work-orders/:id - Ažuriranje naloga
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('title')
      .optional()
      .isLength({ min: 3, max: 200 })
      .withMessage('Naslov mora imati između 3 i 200 karaktera'),
    body('description')
      .optional()
      .isLength({ min: 10 })
      .withMessage('Opis mora imati najmanje 10 karaktera'),
    body('location').optional().isString(),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Geografska širina mora biti između -90 i 90'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Geografska dužina mora biti između -180 i 180'),
    body('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
      .withMessage('Prioritet mora biti LOW, MEDIUM, HIGH ili URGENT'),
    body('deadline')
      .optional()
      .isISO8601()
      .withMessage('Nevažeći format datuma'),
    body('assignedToId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('ID dodijeljenog korisnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.update.bind(workOrderController)
);

// PATCH /api/work-orders/:id/status - Promjena statusa
router.patch(
  '/:id/status',
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('status')
      .notEmpty()
      .withMessage('Status je obavezan')
      .isIn(['NEW', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'])
      .withMessage('Status mora biti NEW, ACCEPTED, IN_PROGRESS, ON_HOLD ili COMPLETED'),
    body('note')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Napomena ne smije imati više od 500 karaktera'),
    validate,
  ],
  workOrderController.updateStatus.bind(workOrderController)
);

// DELETE /api/work-orders/:id - Brisanje naloga (samo administrator)
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  workOrderController.delete.bind(workOrderController)
);

export default router;
