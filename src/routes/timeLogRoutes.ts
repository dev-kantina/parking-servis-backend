import { Router, IRouter } from 'express';
import { body, param } from 'express-validator';
import timeLogController from '../controllers/timeLogController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router: IRouter = Router();

router.use(authenticate);

// Start Timer
router.post(
  '/start',
  [
    body('workOrderId').isUUID().withMessage('ID radnog naloga mora biti validan UUID'),
    validate,
  ],
  timeLogController.startTimer.bind(timeLogController)
);

// Stop Timer
router.post(
  '/stop',
  [
    body('note').optional().isString(),
    validate,
  ],
  timeLogController.stopTimer.bind(timeLogController)
);

// Manual Entry
router.post(
  '/manual',
  [
    body('workOrderId').isUUID(),
    body('startTime').isISO8601().withMessage('Vrijeme početka mora biti validan datum'),
    body('endTime').isISO8601().withMessage('Vrijeme završetka mora biti validan datum'),
    body('note').optional().isString(),
    validate,
  ],
  timeLogController.logManual.bind(timeLogController)
);

// Get Active Timer
router.get(
  '/active',
  timeLogController.getActive.bind(timeLogController)
);

// Get Logs for Work Order
router.get(
  '/work-order/:workOrderId',
  [
    param('workOrderId').isUUID(),
    validate,
  ],
  timeLogController.getByWorkOrder.bind(timeLogController)
);

export default router;
