import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, CreateEquipmentTypeDto, UpdateEquipmentTypeDto } from '../types';
import equipmentTypeService from '../services/equipmentTypeService';

export class EquipmentTypeController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const equipmentTypes = await equipmentTypeService.getAll(includeInactive === 'true');

      const response: ApiResponse = {
        success: true,
        data: equipmentTypes,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const equipmentType = await equipmentTypeService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: equipmentType,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateEquipmentTypeDto = req.body;
      const equipmentType = await equipmentTypeService.create(data);

      const response: ApiResponse = {
        success: true,
        message: 'Tip opreme uspješno kreiran',
        data: equipmentType,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateEquipmentTypeDto = req.body;
      const equipmentType = await equipmentTypeService.update(id, data);

      const response: ApiResponse = {
        success: true,
        message: 'Tip opreme uspješno ažuriran',
        data: equipmentType,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await equipmentTypeService.delete(id);

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

      const equipmentType = await equipmentTypeService.updateStatus(id, isActive);

      const response: ApiResponse = {
        success: true,
        message: isActive ? 'Tip opreme aktiviran' : 'Tip opreme deaktiviran',
        data: equipmentType,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new EquipmentTypeController();
