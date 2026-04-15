import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../types';
import standardService, { CreateStandardDto, UpdateStandardDto, GenerateWorkOrdersDto } from '../services/standardService';
import { RecurrenceType, WorkOrderPriority } from '../../generated/prisma';

export class StandardController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        active,
        groupId,
        search,
        assignedToId,
        recurrenceType,
        priority,
      } = req.query;

      const onlyActive = active === 'true' ? true : active === 'false' ? false : undefined;

      let groupFilter: string | null | undefined;
      if (groupId === 'null') {
        groupFilter = null;
      } else if (typeof groupId === 'string' && groupId) {
        groupFilter = groupId;
      }

      let assignedFilter: string | null | undefined;
      if (assignedToId === 'null') {
        assignedFilter = null;
      } else if (typeof assignedToId === 'string' && assignedToId) {
        assignedFilter = assignedToId;
      }

      const recurrenceFilter =
        typeof recurrenceType === 'string' &&
        Object.values(RecurrenceType).includes(recurrenceType as RecurrenceType)
          ? (recurrenceType as RecurrenceType)
          : undefined;

      const priorityFilter =
        typeof priority === 'string' &&
        Object.values(WorkOrderPriority).includes(priority as WorkOrderPriority)
          ? (priority as WorkOrderPriority)
          : undefined;

      const standards = await standardService.getAll({
        onlyActive,
        groupId: groupFilter,
        defaultAssignedToId: assignedFilter,
        recurrenceType: recurrenceFilter,
        priority: priorityFilter,
        search: typeof search === 'string' && search ? search : undefined,
      });

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

  async previewGenerate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: GenerateWorkOrdersDto = req.body;
      const occurrences = await standardService.previewGeneration(data);

      const response: ApiResponse = {
        success: true,
        data: occurrences,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new StandardController();
