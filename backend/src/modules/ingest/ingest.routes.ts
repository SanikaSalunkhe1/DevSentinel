import express, { Router, Request, Response, NextFunction } from 'express';
import { ingestController } from './ingest.controller.js';
import { requireApiKey } from '../../middleware/apikey.middleware.js';
import { createRateLimiter } from '../../middleware/ratelimit.middleware.js';

export interface IngestRouterOptions {
  /** Override rate limit max requests (useful in tests) */
  maxRequests?: number;
  /** Override rate limit window in ms */
  windowMs?: number;
}

export function createIngestRouter(options: IngestRouterOptions = {}): Router {
  const router = Router();

  // Enforce strict 512kb payload limit on telemetry ingestion routes
  router.use(express.json({ limit: '512kb' }));
  router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      res.status(413).json({
        error: 'PayloadTooLarge',
        message: 'Telemetry payload exceeds the 512KB limit.',
      });
      return;
    }
    next(err);
  });

  // Authenticate using Application API Key
  router.use(requireApiKey);

  // Rate limit per applicationId
  router.use(
    createRateLimiter({
      windowMs: options.windowMs ?? 60_000,
      maxRequests: options.maxRequests ?? 120,
    })
  );

  router.post('/', ingestController.ingestBatch.bind(ingestController));
  router.post('/logs', ingestController.ingestLogs.bind(ingestController));
  router.post('/metrics', ingestController.ingestMetrics.bind(ingestController));

  return router;
}

export default createIngestRouter();
