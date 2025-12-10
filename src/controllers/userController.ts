import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import userService, { UserFilters, CreateUserDto, UpdateUserDto } from '../services/userService';
import { ApiResponse } from '../types';
import { Role } from '../../generated/prisma';

export class UserController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, isActive, search } = req.query;

      const filters: UserFilters = {};

      if (role && Object.values(Role).includes(role as Role)) {
        filters.role = role as Role;
      }

      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      if (search) {
        filters.search = search as string;
      }

      const users = await userService.getAll(filters);

      const response: ApiResponse = {
        success: true,
        data: users,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.getById(id);

      const response: ApiResponse = {
        success: true,
        data: user,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateUserDto = req.body;
      const user = await userService.create(data);

      const response: ApiResponse = {
        success: true,
        message: 'Korisnik uspješno kreiran',
        data: user,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateUserDto = req.body;
      const user = await userService.update(id, data);

      const response: ApiResponse = {
        success: true,
        message: 'Korisnik uspješno ažuriran',
        data: user,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await userService.delete(id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getWorkers(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workers = await userService.getWorkers();

      const response: ApiResponse = {
        success: true,
        data: workers,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getWorkersWithStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workers = await userService.getWorkersWithStats();

      const response: ApiResponse = {
        success: true,
        data: workers,
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

      const user = await userService.updateStatus(id, isActive);

      const response: ApiResponse = {
        success: true,
        message: isActive ? 'Korisnik aktiviran' : 'Korisnik deaktiviran',
        data: user,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();

