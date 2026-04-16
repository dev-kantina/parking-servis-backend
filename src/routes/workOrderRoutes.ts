import { Router, IRouter } from 'express'
import { body, param, query } from 'express-validator'
import workOrderController from '../controllers/workOrderController'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { Role } from '../../generated/prisma'

const router: IRouter = Router()

// Svi zahtjevi moraju biti autentifikovani
router.use(authenticate)

// GET /api/work-orders/stats - Statistike (samo za menadžere i administratore)
router.get(
  '/stats',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  workOrderController.getStats.bind(workOrderController),
)

// GET /api/work-orders/calendar - Kalendarski prikaz (samo za menadžere i administratore)
router.get(
  '/calendar',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    query('year')
      .optional()
      .isInt({ min: 2020, max: 2100 })
      .withMessage('Godina mora biti između 2020 i 2100'),
    query('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Mjesec mora biti između 1 i 12'),
    query('workerId')
      .optional()
      .isUUID()
      .withMessage('ID radnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.getCalendarData.bind(workOrderController),
)

// GET /api/work-orders/calendar/:date - Detalji dana (samo za menadžere i administratore)
router.get(
  '/calendar/:date',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('date').isISO8601().withMessage('Datum mora biti u ISO8601 formatu'),
    query('workerId')
      .optional()
      .isUUID()
      .withMessage('ID radnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.getDayDetails.bind(workOrderController),
)

// GET /api/work-orders/affected-by-absence - Radni nalozi pogođeni odsustvom radnika
router.get(
  '/affected-by-absence',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    query('userId')
      .notEmpty()
      .isUUID()
      .withMessage('ID korisnika mora biti validan UUID'),
    query('date')
      .notEmpty()
      .isISO8601()
      .withMessage('Datum mora biti u ISO8601 formatu'),
    validate,
  ],
  workOrderController.getAffectedByAbsence.bind(workOrderController),
)

// POST /api/work-orders/reassign - Preraspodjela radnih naloga
router.post(
  '/reassign',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('reassignments')
      .isArray({ min: 1 })
      .withMessage('Mora biti najmanje jedna preraspodjela'),
    body('reassignments.*.workOrderId')
      .isUUID()
      .withMessage('ID radnog naloga mora biti validan UUID'),
    body('reassignments.*.fromUserId')
      .isUUID()
      .withMessage('ID izvornog korisnika mora biti validan UUID'),
    body('reassignments.*.toUserId')
      .isUUID()
      .withMessage('ID ciljnog korisnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.reassign.bind(workOrderController),
)

// GET /api/work-orders/my - Moji nalozi (za radnike)
router.get('/my', workOrderController.getMyOrders.bind(workOrderController))

// GET /api/work-orders - Lista svih naloga
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Stranica mora biti pozitivan broj'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Limit mora biti između 1 i 10000'),
    query('status').optional().isString(),
    query('priority').optional().isString(),
    validate,
  ],
  workOrderController.getAll.bind(workOrderController),
)

// GET /api/work-orders/:id - Detalji naloga
router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  workOrderController.getById.bind(workOrderController),
)

// POST /api/work-orders - Kreiranje naloga (samo menadžeri, administratori i tehnička podrška)
router.post(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('title')
      .notEmpty()
      .withMessage('Naslov je obavezan')
      .isLength({ min: 3, max: 200 })
      .withMessage('Naslov mora imati između 3 i 200 karaktera'),
    body('description')
      .notEmpty()
      .withMessage('Opis je obavezan')
      .isLength({ min: 4 })
      .withMessage('Opis mora imati najmanje 4 karaktera'),
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
    body('resources').optional().isString(),
    body('assignedToIds')
      .optional()
      .isArray()
      .withMessage('assignedToIds mora biti niz'),
    body('assignedToIds.*')
      .isUUID()
      .withMessage('Svaki ID dodijeljenog korisnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.create.bind(workOrderController),
)

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
      .isLength({ min: 4 })
      .withMessage('Opis mora imati najmanje 4 karaktera'),
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
    body('assignedToIds')
      .optional()
      .isArray()
      .withMessage('assignedToIds mora biti niz'),
    body('assignedToIds.*')
      .isUUID()
      .withMessage('Svaki ID dodijeljenog korisnika mora biti validan UUID'),
    validate,
  ],
  workOrderController.update.bind(workOrderController),
)

// PATCH /api/work-orders/:id/status - Promjena statusa
router.patch(
  '/:id/status',
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('status')
      .notEmpty()
      .withMessage('Status je obavezan')
      .isIn([
        'NEW',
        'ACCEPTED',
        'IN_PROGRESS',
        'ON_HOLD',
        'COMPLETED',
        'CANCELLED',
        'DECLINED',
      ])
      .withMessage(
        'Status mora biti NEW, ACCEPTED, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED ili DECLINED',
      ),
    body('note')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Napomena ne smije imati više od 500 karaktera'),
    validate,
  ],
  workOrderController.updateStatus.bind(workOrderController),
)

// DELETE /api/work-orders/:id - Brisanje naloga
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.TECHNICAL_SUPPORT),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  workOrderController.delete.bind(workOrderController),
)

export default router
