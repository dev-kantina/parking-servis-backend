import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import workOrderRoutes from './routes/workOrderRoutes';
import userRoutes from './routes/userRoutes';
import commentRoutes from './routes/commentRoutes';
import timeLogRoutes from './routes/timeLogRoutes';
import notificationRoutes from './routes/notificationRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { errorHandler } from './middleware/errorHandler';

console.log('Loading dotenv config...');
dotenv.config();
console.log('✓ Dotenv loaded');

const app: Application = express();

console.log('Setting up CORS...');
// CORS configuration
const corsOptions = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS to all routes (this handles OPTIONS preflight automatically)
app.use(cors(corsOptions));
console.log('✓ CORS configured with origin: *');

// Log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`>>> ${req.method} ${req.path} from ${req.ip}`);
  console.log('    Origin:', req.get('Origin'));
  console.log('    User-Agent:', req.get('User-Agent'));
  next();
});

console.log('Setting up body parsers...');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('✓ Body parsers configured');

app.get('/health', (_req: Request, res: Response) => {
  console.log('>>> HEALTH CHECK REQUEST');
  res.status(200).json({
    success: true,
    message: 'WOMS API is running',
    timestamp: new Date().toISOString(),
  });
});

console.log('Setting up routes...');
app.use('/api/auth', authRoutes);
app.use('/api/work-orders/:workOrderId/comments', commentRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/time-logs', timeLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/attachments', attachmentRoutes);
console.log('✓ All routes configured');

console.log('Setting up error handler...');
app.use(errorHandler);
console.log('✓ Error handler configured');

export default app;