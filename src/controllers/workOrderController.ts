import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import workOrderService, { CreateWorkOrderDto, UpdateWorkOrderDto, WorkOrderFilters } from '../services/workOrderService';
import { ApiResponse } from '../types';
import { WorkOrderStatus, WorkOrderPriority } from '../../generated/prisma';

export class WorkOrderController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        status,
        priority,
        assignedToId,
        search,
        deadlineBefore,
        deadlineAfter,
      } = req.query;

      const filters: WorkOrderFilters = {};

      if (status && Object.values(WorkOrderStatus).includes(status as WorkOrderStatus)) {
        filters.status = status as WorkOrderStatus;
      }

      if (priority && Object.values(WorkOrderPriority).includes(priority as WorkOrderPriority)) {
        filters.priority = priority as WorkOrderPriority;
      }

      if (assignedToId) {
        filters.assignedToId = assignedToId as string;
      }

      if (search) {
        filters.search = search as string;
      }

      if (deadlineBefore) {
        filters.deadlineBefore = new Date(deadlineBefore as string);
      }

      if (deadlineAfter) {
        filters.deadlineAfter = new Date(deadlineAfter as string);
      }

      const result = await workOrderService.getAll(filters, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getMyOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Korisnik nije autentifikovan');
      }

      const { page = '1', limit = '10', status, priority } = req.query;

      const filters: WorkOrderFilters = {};

      if (status && Object.values(WorkOrderStatus).includes(status as WorkOrderStatus)) {
        filters.status = status as WorkOrderStatus;
      }

      if (priority && Object.values(WorkOrderPriority).includes(priority as WorkOrderPriority)) {
        filters.priority = priority as WorkOrderPriority;
      }

      const result = await workOrderService.getMyOrders(req.user.id, filters, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await workOrderService.getStats();

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workOrder = await workOrderService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: workOrder,
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

      const data: CreateWorkOrderDto = req.body;
      const workOrder = await workOrderService.create(data, req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Radni nalog uspješno kreiran',
        data: workOrder,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Korisnik nije autentifikovan');
      }

      const { id } = req.params;
      const data: UpdateWorkOrderDto = req.body;
      const workOrder = await workOrderService.update(id, data, req.user.id, req.user.role);

      const response: ApiResponse = {
        success: true,
        message: 'Radni nalog uspješno ažuriran',
        data: workOrder,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Korisnik nije autentifikovan');
      }

      const { id } = req.params;
      const { status, note } = req.body;

      if (!status || !Object.values(WorkOrderStatus).includes(status)) {
        throw new Error('Nevažeći status');
      }

      const workOrder = await workOrderService.updateStatus(
        id,
        status as WorkOrderStatus,
        req.user.id,
        req.user.role,
        note
      );

      const response: ApiResponse = {
        success: true,
        message: 'Status radnog naloga uspješno promijenjen',
        data: workOrder,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await workOrderService.delete(id);

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

export default new WorkOrderController();
