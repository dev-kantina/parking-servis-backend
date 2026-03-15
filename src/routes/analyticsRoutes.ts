import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../../generated/prisma';

const router: Router = Router();

// Sve rute za analitiku zahtijevaju autentifikaciju
router.use(authenticate);

// Live status je dostupan i za menadžere i tehničku podršku (koristi se na kontrolnoj tabli)
router.get('/live', authorize(Role.ADMINISTRATOR, Role.MANAGER, Role.TECHNICAL_SUPPORT), analyticsController.getLiveStatus);

// Analitičke rute za administratore i tehničku podršku
router.use(authorize(Role.ADMINISTRATOR, Role.TECHNICAL_SUPPORT));
router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/workers', analyticsController.getWorkerPerformance);
router.get('/trends', analyticsController.getTrends);
router.get('/export', analyticsController.exportData);

export default router;
