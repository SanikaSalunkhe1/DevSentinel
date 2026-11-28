import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspace/workspace.routes.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { config } from './config/index.js';

dotenv.config();

const app = express();
const PORT = config.port;

// Middleware
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Base Endpoints
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'devsentinel-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'DevSentinel API',
    version: '0.1.0',
    status: 'operational',
    endpoints: {
      auth: '/api/v1/auth',
      workspaces: '/api/v1/workspaces',
      health: '/health',
    },
  });
});

// Authentication Routes
app.use('/api/v1/auth', authRoutes);

// Workspace Routes
app.use('/api/v1/workspaces', workspaceRoutes);

// Protected Test Route (Used to verify route guard)
app.get('/api/v1/test/protected', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Access granted to protected route',
    user: {
      id: req.user?.id,
      email: req.user?.email,
      name: req.user?.name,
    },
    workspaces: req.user?.memberships.map((m) => m.workspace.name),
  });
});

// Centralized Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
  });
});

export default app;
