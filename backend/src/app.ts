import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'devsentinel-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root / API info
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'DevSentinel API',
    version: '0.1.0',
    status: 'operational',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[DevSentinel Backend] Running on http://localhost:${PORT}`);
    console.log(`[DevSentinel Backend] Health check available at http://localhost:${PORT}/health`);
  });
}

export default app;
