import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import scheduleService, { SetScheduleEntryDto, BulkScheduleDto, SetDateEntryDto, GenerateScheduleDto } from '../services/scheduleService';
import { ApiResponse } from '../types';
import { DayOfWeek } from '../../generated/prisma';

export class ScheduleController {
  async getAll(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedules = await scheduleService.getAll();

      const response: ApiResponse = {
        success: true,
        data: schedules,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getByUserId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const schedules = await scheduleService.getByUserId(userId);

      const response: ApiResponse = {
        success: true,
        data: schedules,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async setScheduleEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: SetScheduleEntryDto = req.body;
      const schedule = await scheduleService.setScheduleEntry(data);

      const response: ApiResponse = {
        success: true,
        message: 'Raspored uspješno postavljen',
        data: schedule,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateUserSchedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { schedule } = req.body;

      const data: BulkScheduleDto = {
        userId,
        schedule,
      };

      const result = await scheduleService.bulkUpdateUserSchedule(data);

      const response: ApiResponse = {
        success: true,
        message: 'Raspored uspješno ažuriran',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteScheduleEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await scheduleService.deleteScheduleEntry(id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteUserDaySchedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, dayOfWeek } = req.params;
      const result = await scheduleService.deleteUserDaySchedule(userId, dayOfWeek as DayOfWeek);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getScheduleMatrix(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const matrix = await scheduleService.getScheduleMatrix();

      const response: ApiResponse = {
        success: true,
        data: matrix,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getMyShiftToday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await scheduleService.getMyShiftToday(req.user!.id);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // DATE-SPECIFIC SCHEDULE ENTRY ENDPOINTS
  // ========================================

  async getEntriesByDateRange(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, userId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate i endDate su obavezni',
        });
        return;
      }

      const entries = await scheduleService.getEntriesByDateRange(
        startDate as string,
        endDate as string,
        userId as string | undefined
      );

      const response: ApiResponse = {
        success: true,
        data: entries,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async setDateEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: SetDateEntryDto = req.body;
      const entry = await scheduleService.setDateEntry(data);

      const response: ApiResponse = {
        success: true,
        message: 'Unos rasporeda uspješno postavljen',
        data: entry,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteDateEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, date } = req.params;
      const result = await scheduleService.deleteDateEntry(userId, date);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async generateFromTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: GenerateScheduleDto = req.body;
      const result = await scheduleService.generateFromTemplate(data);

      const response: ApiResponse = {
        success: true,
        message: result.message,
        data: { count: result.count },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getCalendarView(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate i endDate su obavezni',
        });
        return;
      }

      const calendar = await scheduleService.getCalendarView(
        startDate as string,
        endDate as string
      );

      const response: ApiResponse = {
        success: true,
        data: calendar,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getWorkersAvailableOnDate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.query;

      if (!date) {
        res.status(400).json({
          success: false,
          error: 'date je obavezan parametar',
        });
        return;
      }

      const workers = await scheduleService.getWorkersAvailableOnDate(date as string);

      const response: ApiResponse = {
        success: true,
        data: workers,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new ScheduleController();
