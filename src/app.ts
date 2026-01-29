import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes'
import workOrderRoutes from './routes/workOrderRoutes'
import userRoutes from './routes/userRoutes'
import commentRoutes from './routes/commentRoutes'
import timeLogRoutes from './routes/timeLogRoutes'
import notificationRoutes from './routes/notificationRoutes'
import attachmentRoutes from './routes/attachmentRoutes'
import analyticsRoutes from './routes/analyticsRoutes'
import shiftRoutes from './routes/shiftRoutes'
import scheduleRoutes from './routes/scheduleRoutes'
import equipmentTypeRoutes from './routes/equipmentTypeRoutes'
import equipmentRoutes from './routes/equipmentRoutes'
import { errorHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimiter'

dotenv.config()

const app: Application = express()

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[]

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
app.use('/api/time-logs', timeLogRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/attachments', attachmentRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/equipment-types', equipmentTypeRoutes)
app.use('/api/equipment', equipmentRoutes)

app.use(errorHandler)

export default app
