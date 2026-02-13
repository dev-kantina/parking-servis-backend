import { Router, IRouter } from 'express'
import { body } from 'express-validator'
import pushSubscriptionController from '../controllers/pushSubscriptionController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validation'

const router: IRouter = Router()

router.use(authenticate)

router.post(
  '/subscribe',
  [
    body('endpoint').isURL().withMessage('Valid endpoint URL is required'),
    body('keys.p256dh').isString().notEmpty().withMessage('p256dh key is required'),
    body('keys.auth').isString().notEmpty().withMessage('auth key is required'),
    validate,
  ],
  pushSubscriptionController.subscribe.bind(pushSubscriptionController),
)

router.post(
  '/unsubscribe',
  [
    body('endpoint').isURL().withMessage('Valid endpoint URL is required'),
    validate,
  ],
  pushSubscriptionController.unsubscribe.bind(pushSubscriptionController),
)

export default router
