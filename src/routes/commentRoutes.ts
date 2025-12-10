import { Router, IRouter } from 'express';
import { param, body } from 'express-validator';
import commentController from '../controllers/commentController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router: IRouter = Router({ mergeParams: true }); // Important for accessing workOrderId from parent router

// Svi zahtjevi moraju biti autentifikovani
router.use(authenticate);

// GET /api/work-orders/:workOrderId/comments - Lista komentara
router.get(
  '/',
  [
    param('workOrderId').isUUID().withMessage('ID radnog naloga mora biti validan UUID'),
    validate,
  ],
  commentController.getByWorkOrderId.bind(commentController)
);

// POST /api/work-orders/:workOrderId/comments - Kreiranje komentara
router.post(
  '/',
  [
    param('workOrderId').isUUID().withMessage('ID radnog naloga mora biti validan UUID'),
    body('content').notEmpty().withMessage('Sadržaj komentara ne može biti prazan'),
    body('isInternal').optional().isBoolean(),
    validate,
  ],
  commentController.create.bind(commentController)
);

// PUT /api/work-orders/:workOrderId/comments/:id - Ažuriranje komentara
router.put(
  '/:id',
  [
    param('workOrderId').isUUID().withMessage('ID radnog naloga mora biti validan UUID'),
    param('id').isUUID().withMessage('ID komentara mora biti validan UUID'),
    body('content').notEmpty().withMessage('Sadržaj komentara ne može biti prazan'),
    validate,
  ],
  commentController.update.bind(commentController)
);

// DELETE /api/work-orders/:workOrderId/comments/:id - Brisanje komentara
router.delete(
  '/:id',
  [
    param('workOrderId').isUUID().withMessage('ID radnog naloga mora biti validan UUID'),
    param('id').isUUID().withMessage('ID komentara mora biti validan UUID'),
    validate,
  ],
  commentController.delete.bind(commentController)
);

export default router;
