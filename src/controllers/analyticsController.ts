import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { exportService } from '../services/exportService';
import { subDays } from 'date-fns';
import { getBusinessToday, getBusinessDayBounds, getBusinessMonthBounds } from '../utils/timezone';

function getDateRange(query: Request['query']) {
  const { period, startDate, endDate } = query;
  const now = new Date();

  // Custom date range takes precedence
  if (startDate && endDate) {
    const { start } = getBusinessDayBounds(startDate as string);
    const { end } = getBusinessDayBounds(endDate as string);
    return { startDate: start, endDate: end };
  }

  // Predefined periods
  if (period === 'week') {
    // Find Monday of the current week in business timezone
    const todayStr = getBusinessToday(now);
    const todayDate = new Date(todayStr + 'T12:00:00Z'); // noon UTC to avoid DST edge
    const dow = todayDate.getUTCDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const mondayDate = new Date(todayDate);
    mondayDate.setUTCDate(mondayDate.getUTCDate() + mondayOffset);
    const mondayStr = `${mondayDate.getUTCFullYear()}-${String(mondayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(mondayDate.getUTCDate()).padStart(2, '0')}`;
    const sundayDate = new Date(mondayDate);
    sundayDate.setUTCDate(sundayDate.getUTCDate() + 6);
    const sundayStr = `${sundayDate.getUTCFullYear()}-${String(sundayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(sundayDate.getUTCDate()).padStart(2, '0')}`;
    const { start } = getBusinessDayBounds(mondayStr);
    const { end } = getBusinessDayBounds(sundayStr);
    return { startDate: start, endDate: end };
  } else if (period === 'month') {
    const todayStr = getBusinessToday(now);
    const year = parseInt(todayStr.substring(0, 4));
    const month = parseInt(todayStr.substring(5, 7));
    const { start, end } = getBusinessMonthBounds(year, month);
    return { startDate: start, endDate: end };
  } else if (period === 'last30') {
    return { startDate: subDays(now, 30), endDate: now };
  }

  return undefined;
}

export class AnalyticsController {
  async getDashboardStats(req: Request, res: Response) {
    try {
      const range = getDateRange(req.query);
      const workOrderType = req.query.workOrderType as 'all' | 'standard' | 'regular' | undefined;
      const stats = await analyticsService.getDashboardStats(range, workOrderType);
      res.json(stats);
    } catch (error) {
      console.error('Analytics stats error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }

  async getWorkerPerformance(req: Request, res: Response) {
    try {
      const range = getDateRange(req.query);
      const workOrderType = req.query.workOrderType as 'all' | 'standard' | 'regular' | undefined;
      const performance = await analyticsService.getWorkerPerformance(range, workOrderType);
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

  async getLiveStatus(req: Request, res: Response) {
    try {
      const workOrderType = req.query.workOrderType as 'all' | 'standard' | 'regular' | undefined;
      const liveStatus = await analyticsService.getLiveStatus(workOrderType);
      res.json({ success: true, data: liveStatus });
    } catch (error) {
      console.error('Live status error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch live status' });
    }
  }
}

export const analyticsController = new AnalyticsController();
