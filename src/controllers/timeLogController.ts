import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import timeLogService from '../services/timeLogService';
import { ApiResponse } from '../types';

export class TimeLogController {
  async startTimer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const { workOrderId } = req.body;
      const timeLog = await timeLogService.startTimer(workOrderId, req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Tajmer pokrenut',
        data: timeLog,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async stopTimer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const { note } = req.body;
      const timeLog = await timeLogService.stopTimer(req.user.id, note);

      const response: ApiResponse = {
        success: true,
        message: 'Tajmer zaustavljen',
        data: timeLog,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async logManual(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const { workOrderId, startTime, endTime, note } = req.body;
      
      const timeLog = await timeLogService.logManual({
        workOrderId,
        userId: req.user.id,
        startTime,
        endTime,
        note,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Vrijeme ručno evidentirano',
        data: timeLog,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getActive(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const activeTimer = await timeLogService.getActiveByUser(req.user.id);

      const response: ApiResponse = {
        success: true,
        data: activeTimer,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getByWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workOrderId } = req.params;
      const logs = await timeLogService.getByWorkOrderId(workOrderId);

      const response: ApiResponse = {
        success: true,
        data: logs,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new TimeLogController();
