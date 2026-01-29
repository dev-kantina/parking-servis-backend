import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, CreateEquipmentDto, UpdateEquipmentDto } from '../types';
import equipmentService, { EquipmentFilters } from '../services/equipmentService';

export class EquipmentController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { typeId, isActive, search } = req.query;

      const filters: EquipmentFilters = {};
      if (typeId) filters.typeId = typeId as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (search) filters.search = search as string;

      const equipment = await equipmentService.getAll(filters);

      const response: ApiResponse = {
        success: true,
        data: equipment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const equipment = await equipmentService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: equipment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateEquipmentDto = req.body;
      const equipment = await equipmentService.create(data);

      const response: ApiResponse = {
        success: true,
        message: 'Oprema uspješno kreirana',
        data: equipment,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateEquipmentDto = req.body;
      const equipment = await equipmentService.update(id, data);

      const response: ApiResponse = {
        success: true,
        message: 'Oprema uspješno ažurirana',
        data: equipment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await equipmentService.delete(id);

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

      const equipment = await equipmentService.updateStatus(id, isActive);

      const response: ApiResponse = {
        success: true,
        message: isActive ? 'Oprema aktivirana' : 'Oprema deaktivirana',
        data: equipment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getAvailableForWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const equipment = await equipmentService.getAvailableForWorkOrder();

      const response: ApiResponse = {
        success: true,
        data: equipment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new EquipmentController();
