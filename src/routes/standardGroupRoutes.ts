import { Router, IRouter } from 'express'
import { body, param } from 'express-validator'
import standardGroupController from '../controllers/standardGroupController'
import { authenticate, authorize } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { Role } from '../../generated/prisma'

const router: IRouter = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  standardGroupController.getAll.bind(standardGroupController),
)

router.get(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  standardGroupController.getById.bind(standardGroupController),
)

router.post(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    body('name')
      .notEmpty()
      .withMessage('Naziv je obavezan')
      .isLength({ min: 2, max: 100 })
      .withMessage('Naziv mora imati između 2 i 100 karaktera'),
    body('description').optional({ nullable: true }).isString(),
    validate,
  ],
  standardGroupController.create.bind(standardGroupController),
)

router.put(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Naziv mora imati između 2 i 100 karaktera'),
    body('description').optional({ nullable: true }).isString(),
    body('isActive').optional().isBoolean(),
    validate,
  ],
  standardGroupController.update.bind(standardGroupController),
)

router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.TECHNICAL_SUPPORT),
  [param('id').isUUID().withMessage('ID mora biti validan UUID'), validate],
  standardGroupController.delete.bind(standardGroupController),
)

export default router
