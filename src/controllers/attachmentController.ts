import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import attachmentService from '../services/attachmentService';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../types';

export class AttachmentController {
  async upload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ApiError(400, 'Nije odabran fajl');
      }

      const { workOrderId } = req.params;
      
      const attachment = await attachmentService.create({
        workOrderId,
        file: req.file,
      });

      const response: ApiResponse = {
        success: true,
        data: attachment,
        message: 'Fajl uspješno postavljen',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Optional: Check permissions (if user allowed to delete)
      
      const result = await attachmentService.delete(id);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
  
    async getByWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workOrderId } = req.params;
      
      const attachments = await attachmentService.getByWorkOrderId(workOrderId);

      const response: ApiResponse = {
        success: true,
        data: attachments,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new AttachmentController();
