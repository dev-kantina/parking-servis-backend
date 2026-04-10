import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../types';
import standardGroupService, {
  CreateStandardGroupDto,
  UpdateStandardGroupDto,
} from '../services/standardGroupService';

export class StandardGroupController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { active } = req.query;
      const onlyActive = active === 'true' ? true : active === 'false' ? false : undefined;
      const groups = await standardGroupService.getAll(onlyActive);

      const response: ApiResponse = {
        success: true,
        data: groups,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const group = await standardGroupService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: group,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateStandardGroupDto = req.body;
      const group = await standardGroupService.create(data);

      const response: ApiResponse = {
        success: true,
        message: 'Grupa standarda uspješno kreirana',
        data: group,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateStandardGroupDto = req.body;
      const group = await standardGroupService.update(id, data);

      const response: ApiResponse = {
        success: true,
        message: 'Grupa standarda uspješno ažurirana',
        data: group,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await standardGroupService.delete(id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new StandardGroupController();
