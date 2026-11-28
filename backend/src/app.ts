import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspace/workspace.routes.js';
import applicationRoutes from './modules/application/application.routes.js';
import apiKeyRoutes from './modules/apikey/apikey.routes.js';
import ingestRoutes from './modules/ingest/ingest.routes.js';
import { ingestController } from './modules/ingest/ingest.controller.js';
import { apiKeyController } from './modules/apikey/apikey.controller.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { requireWorkspaceMember } from './middleware/workspace.middleware.js';
import { requireApiKey } from './middleware/apikey.middleware.js';
import { config } from './config/index.js';

dotenv.config();

const app = express();
const PORT = config.port;

// Middleware
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

// Telemetry Ingestion Routes (mounted before global 5mb JSON parser to enforce strict 512kb limit)
app.use('/api/v1/ingest', ingestRoutes);

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
      applications: '/api/v1/workspaces/:workspaceId/applications',
      ingest: '/api/v1/ingest',
      health: '/health',
    },
  });
});

// Authentication Routes
app.use('/api/v1/auth', authRoutes);

// Workspace Routes
app.use('/api/v1/workspaces', workspaceRoutes);

// Application Routes (nested under workspaces)
app.use('/api/v1/workspaces/:workspaceId/applications', applicationRoutes);

// API Key Management Routes (nested under applications)
app.use('/api/v1/workspaces/:workspaceId/applications/:applicationId/keys', apiKeyRoutes);

// Workspace-scoped Telemetry Query Route
app.get(
  '/api/v1/workspaces/:workspaceId/applications/:applicationId/telemetry',
  requireAuth,
  requireWorkspaceMember,
  ingestController.listTelemetry.bind(ingestController)
);

// API Key Validation Endpoint (for SDKs / services)
app.post('/api/v1/auth/validate-key', apiKeyController.validateKey.bind(apiKeyController));

// Protected API Key Test Route (Used to verify requireApiKey middleware)
app.get('/api/v1/test/apikey-protected', requireApiKey, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API key authenticated',
    data: req.apiKey,
  });
});

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
