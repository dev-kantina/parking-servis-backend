import { Router, IRouter } from 'express'
import { body, param } from 'express-validator'
import standardController from '../controllers/standardController'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { Role } from '../../generated/prisma'

const router: IRouter = Router()

router.use(authenticate)

// GET /api/standards - List all standards
router.get(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  standardController.getAll.bind(standardController),
)

// POST /api/standards/generate - Generate work orders (BEFORE /:id)
router.post(
  '/generate',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('startDate')
      .notEmpty()
      .withMessage('Datum početka je obavezan')
      .isISO8601()
      .withMessage('Nevažeći format datuma početka'),
    body('endDate')
      .notEmpty()
      .withMessage('Datum kraja je obavezan')
      .isISO8601()
      .withMessage('Nevažeći format datuma kraja'),
    body('standardIds')
      .optional()
      .isArray()
      .withMessage('standardIds mora biti niz'),
    body('overrides').optional().isArray().withMessage('overrides mora biti niz'),
    body('overrides.*.standardId').optional().isUUID(),
    body('overrides.*.originalDate').optional().isISO8601(),
    body('overrides.*.action').optional().isIn(['move', 'skip']),
    body('overrides.*.newDate').optional().isISO8601(),
    validate,
  ],
  standardController.generate.bind(standardController),
)

// POST /api/standards/preview-generation - Preview what would be generated (BEFORE /:id)
router.post(
  '/preview-generation',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('startDate').notEmpty().isISO8601(),
    body('endDate').notEmpty().isISO8601(),
    body('standardIds').optional().isArray(),
    validate,
  ],
  standardController.previewGenerate.bind(standardController),
)

// GET /api/standards/:id - Get standard details
router.get(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  standardController.getById.bind(standardController),
)

// POST /api/standards - Create standard
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
    body('recurrenceType')
      .notEmpty()
      .withMessage('Tip ponavljanja je obavezan')
      .isIn(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'])
      .withMessage('Tip ponavljanja mora biti DAILY ili WEEKLY'),
    body('daysOfWeek')
      .optional()
      .isArray()
      .withMessage('Dani u sedmici moraju biti niz'),
    body('startTime')
      .notEmpty()
      .withMessage('Vrijeme početka je obavezno')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('Vrijeme mora biti u formatu HH:MM'),
    body('endTime')
      .notEmpty()
      .withMessage('Vrijeme završetka je obavezno')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('Vrijeme mora biti u formatu HH:MM'),
    body('defaultAssignedToId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('ID dodijeljenog korisnika mora biti validan UUID'),
    body('groupId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('ID grupe mora biti validan UUID'),
    validate,
  ],
  standardController.create.bind(standardController),
)

// PUT /api/standards/:id - Update standard
router.put(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
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
    body('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
      .withMessage('Prioritet mora biti LOW, MEDIUM, HIGH ili URGENT'),
    body('recurrenceType')
      .optional()
      .isIn(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'])
      .withMessage('Tip ponavljanja mora biti DAILY ili WEEKLY'),
    body('startTime')
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('Vrijeme mora biti u formatu HH:MM'),
    body('endTime')
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('Vrijeme mora biti u formatu HH:MM'),
    body('groupId')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === '') return true
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        )
      })
      .withMessage('ID grupe mora biti validan UUID ili null'),
    validate,
  ],
  standardController.update.bind(standardController),
)

// DELETE /api/standards/:id - Delete standard
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.TECHNICAL_SUPPORT),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  standardController.delete.bind(standardController),
)

export default router
