import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../types';
import standardService, { CreateStandardDto, UpdateStandardDto, GenerateWorkOrdersDto } from '../services/standardService';

export class StandardController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { active } = req.query;
      const onlyActive = active === 'true' ? true : active === 'false' ? false : undefined;
      const standards = await standardService.getAll(onlyActive);

      const response: ApiResponse = {
        success: true,
        data: standards,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const standard = await standardService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: standard,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Korisnik nije autentifikovan');
      }

      const data: CreateStandardDto = req.body;
      const standard = await standardService.create(data, req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Standard uspješno kreiran',
        data: standard,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateStandardDto = req.body;
      const standard = await standardService.update(id, data);

      const response: ApiResponse = {
        success: true,
        message: 'Standard uspješno ažuriran',
        data: standard,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await standardService.delete(id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async generate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Korisnik nije autentifikovan');
      }

      const data: GenerateWorkOrdersDto = req.body;
      const result = await standardService.generateWorkOrders(data, req.user.id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new StandardController();
