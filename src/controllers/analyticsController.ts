import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { exportService } from '../services/exportService';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays } from 'date-fns';

export class AnalyticsController {
  async getDashboardStats(req: Request, res: Response) {
    try {
      const { period } = req.query;
      let range;

      const now = new Date();
      if (period === 'week') {
        range = { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
      } else if (period === 'month') {
        range = { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      } else if (period === 'last30') {
          range = { startDate: subDays(now, 30), endDate: now };
      }

      const stats = await analyticsService.getDashboardStats(range);
      res.json(stats);
    } catch (error) {
      console.error('Analytics stats error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }

  async getWorkerPerformance(req: Request, res: Response) {
    try {
      const { period } = req.query;
      let range;
      
      const now = new Date();
      if (period === 'week') {
        range = { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
      } else if (period === 'month') {
        range = { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      } else if (period === 'last30') {
          range = { startDate: subDays(now, 30), endDate: now };
      }

      const performance = await analyticsService.getWorkerPerformance(range);
      res.json(performance);
    } catch (error) {
      console.error('Worker performance error:', error);
      res.status(500).json({ error: 'Failed to fetch worker performance' });
    }
  }

  async getTrends(req: Request, res: Response) {
    try {
      const months = req.query.months ? parseInt(req.query.months as string) : 6;
      const trends = await analyticsService.getTrends(months);
      res.json(trends);
    } catch (error) {
        console.error('Analytics trends error:', error);
        res.status(500).json({ error: 'Failed to fetch trends' });
    }
  }

  async exportData(req: Request, res: Response) {
    try {
        const { type } = req.query;
        
        if (type === 'workers') {
            await exportService.exportWorkerStats(res);
        } else {
            await exportService.exportWorkOrders(res);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
  }
}

export const analyticsController = new AnalyticsController();
