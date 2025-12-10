import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import commentService from '../services/commentService';
import { ApiResponse } from '../types';

export class CommentController {
  async getByWorkOrderId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workOrderId } = req.params;
      const comments = await commentService.getByWorkOrderId(workOrderId);

      const response: ApiResponse = {
        success: true,
        data: comments,
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

      const { workOrderId } = req.params;
      const { content, isInternal } = req.body;

      const comment = await commentService.create({
        workOrderId,
        userId: req.user.id,
        content,
        isInternal,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Komentar uspješno kreiran',
        data: comment,
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
      const { content } = req.body;

      const comment = await commentService.update(id, req.user.id, req.user.role, { content });

      const response: ApiResponse = {
        success: true,
        message: 'Komentar uspješno ažuriran',
        data: comment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Korisnik nije autentifikovan');
      }

      const { id } = req.params;

      const result = await commentService.delete(id, req.user.id, req.user.role);

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

export default new CommentController();
