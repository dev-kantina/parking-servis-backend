import { Router, IRouter } from 'express';
import multer from 'multer';
import attachmentController from '../controllers/attachmentController';
import { authenticate } from '../middleware/auth';

const router: IRouter = Router();

// Configure multer to store in memory buffer (so we can stream to GCS)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.use(authenticate);

router.post(
  '/upload/:workOrderId', 
  upload.single('file'), 
  attachmentController.upload.bind(attachmentController)
);

router.delete('/:id', attachmentController.delete.bind(attachmentController));
router.get('/work-order/:workOrderId', attachmentController.getByWorkOrder.bind(attachmentController));

export default router;
