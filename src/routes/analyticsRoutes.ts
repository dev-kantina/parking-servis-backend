import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../../generated/prisma';

const router: Router = Router();

// Sve rute za analitiku zahtijevaju autentifikaciju i admin/manager ulogu
router.use(authenticate);
router.use(authorize(Role.ADMINISTRATOR, Role.MANAGER));

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/workers', analyticsController.getWorkerPerformance);
router.get('/trends', analyticsController.getTrends);
router.get('/export', analyticsController.exportData);

export default router;
