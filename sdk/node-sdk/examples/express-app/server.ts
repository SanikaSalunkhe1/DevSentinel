/**
 * Sample Express Application instrumented with @devsentinel/node-sdk
 *
 * Run from sdk/node-sdk:
 *   DEVSENTINEL_API_KEY=dsk_your_key npx tsx examples/express-app/server.ts
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  initializeDevSentinel,
  devSentinelMiddleware,
  devSentinelErrorMiddleware,
  captureError,
  log,
  shutdown,
} from '../../src/index';

const client = initializeDevSentinel({
  apiKey: process.env.DEVSENTINEL_API_KEY || 'dsk_sample_placeholder_key',
  endpoint: process.env.DEVSENTINEL_ENDPOINT || 'http://localhost:5000/api/v1/ingest',
  serviceName: 'sample-express-app',
  environment: process.env.NODE_ENV || 'development',
  batchSize: 10,
  flushIntervalMs: 3000,
  redactKeys: ['ssn', 'internalSecret'],
  debug: true,
});

const app = express();
app.use(express.json());

// Capture HTTP method, route, status code, and duration
app.use(devSentinelMiddleware());

app.get('/health', (_req: Request, res: Response) => {
  log('info', 'Health check passed', { uptime: process.uptime() });
  res.status(200).json({ status: 'ok' });
});

app.post('/checkout', (req: Request, res: Response) => {
  // Sensitive fields like password/token/internalSecret are automatically redacted
  client.info('Processing checkout request', {
    orderId: 'ord_9876',
    amount: 49.99,
    password: req.body?.password,
    internalSecret: 'never-send-this',
  });

  res.status(201).json({ orderId: 'ord_9876', status: 'processed' });
});

app.get('/boom', () => {
  throw new Error('Simulated unhandled route failure');
});

app.get('/handled-error', (_req: Request, res: Response) => {
  try {
    throw new Error('Simulated caught downstream error');
  } catch (err) {
    captureError(err, { component: 'payment-gateway' });
    res.status(502).json({ error: 'Upstream unavailable' });
  }
});

// Capture unhandled Express errors
app.use(devSentinelErrorMiddleware());

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: err.message });
});

const PORT = Number(process.env.PORT || 4001);
const server = app.listen(PORT, () => {
  console.log(`Sample Express app listening on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await shutdown();
  server.close(() => process.exit(0));
});
