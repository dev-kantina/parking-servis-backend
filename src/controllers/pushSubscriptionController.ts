import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import { ApiResponse } from '../types'
import pushSubscriptionService from '../services/pushSubscriptionService'

export class PushSubscriptionController {
  async subscribe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized')

      const { endpoint, keys } = req.body

      await pushSubscriptionService.subscribe(req.user.id, { endpoint, keys })

      const response: ApiResponse = {
        success: true,
        message: 'Push subscription created',
      }

      res.status(201).json(response)
    } catch (error) {
      next(error)
    }
  }

  async unsubscribe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new Error('Unauthorized')

      const { endpoint } = req.body

      await pushSubscriptionService.unsubscribe(endpoint)

      const response: ApiResponse = {
        success: true,
        message: 'Push subscription removed',
      }

      res.status(200).json(response)
    } catch (error) {
      next(error)
    }
  }
}

export default new PushSubscriptionController()
