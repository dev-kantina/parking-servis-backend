import cors from 'cors'
import dotenv from 'dotenv'
import express, { Application, NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import { errorHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimiter'
import analyticsRoutes from './routes/analyticsRoutes'
import attachmentRoutes from './routes/attachmentRoutes'
import authRoutes from './routes/authRoutes'
import commentRoutes from './routes/commentRoutes'
import equipmentRoutes from './routes/equipmentRoutes'
import equipmentTypeRoutes from './routes/equipmentTypeRoutes'
import notificationRoutes from './routes/notificationRoutes'
import pushSubscriptionRoutes from './routes/pushSubscriptionRoutes'
import scheduleRoutes from './routes/scheduleRoutes'
import shiftRoutes from './routes/shiftRoutes'
import standardRoutes from './routes/standardRoutes'
import userRoutes from './routes/userRoutes'
import workOrderRoutes from './routes/workOrderRoutes'

dotenv.config()

const app: Application = express()

const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean) as string[]

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Apply CORS to all routes (this handles OPTIONS preflight automatically)
app.use(cors(corsOptions))
console.log('CORS configured with allowed origins:', allowedOrigins)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', process.env.R2_PUBLIC_URL || '*'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow loading images from R2
  }),
)

app.use('/api', apiLimiter)

// Log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`>>> ${req.method} ${req.path} from ${req.ip}`)
  console.log('    Origin:', req.get('Origin'))
  console.log('    User-Agent:', req.get('User-Agent'))
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Parking servis Herceg Novi API is running',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/work-orders/:workOrderId/comments', commentRoutes)
app.use('/api/work-orders', workOrderRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/push', pushSubscriptionRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/attachments', attachmentRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/equipment-types', equipmentTypeRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/standards', standardRoutes)

app.use(errorHandler)

export default app
