import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import shiftService, { CreateShiftDto, UpdateShiftDto } from '../services/shiftService';
import { ApiResponse } from '../types';

export class ShiftController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const shifts = await shiftService.getAll(includeInactive === 'true');

      const response: ApiResponse = {
        success: true,
        data: shifts,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const shift = await shiftService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: shift,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateShiftDto = req.body;
      const shift = await shiftService.create(data);

      const response: ApiResponse = {
        success: true,
        message: 'Smjena uspješno kreirana',
        data: shift,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateShiftDto = req.body;
      const shift = await shiftService.update(id, data);

      const response: ApiResponse = {
        success: true,
        message: 'Smjena uspješno ažurirana',
        data: shift,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await shiftService.delete(id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const shift = await shiftService.updateStatus(id, isActive);

      const response: ApiResponse = {
        success: true,
        message: isActive ? 'Smjena aktivirana' : 'Smjena deaktivirana',
        data: shift,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new ShiftController();
