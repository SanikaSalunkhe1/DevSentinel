import { Request, Response } from 'express';
import { TelemetryEventType } from '@prisma/client';
import { ingestService } from './ingest.service.js';
import {
  ingestBatchSchema,
  logEventSchema,
  httpRequestEventSchema,
  ValidatedTelemetryEvent,
} from './ingest.validation.js';
import { applicationService } from '../application/application.service.js';

export class IngestController {
  /**
   * POST /api/v1/ingest
   * Accepts a batch of mixed telemetry events (`http_request`, `error`, `log`).
   */
  async ingestBatch(req: Request, res: Response): Promise<void> {
    try {
      const keyContext = req.apiKey;
      if (!keyContext) {
        res.status(401).json({ error: 'Unauthorized', message: 'API key authentication required' });
        return;
      }

      const parsed = ingestBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid telemetry payload',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const result = await ingestService.ingestBatch(keyContext, parsed.data.events);

      res.status(202).json({
        success: true,
        message: 'Telemetry accepted',
        data: result,
      });
    } catch (error: any) {
      console.error('[IngestController.ingestBatch]:', error?.message || 'Unknown error');
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to ingest telemetry' });
    }
  }

  /**
   * POST /api/v1/ingest/logs
   * Convenience endpoint for ingesting a single structured log or array of logs.
   */
  async ingestLogs(req: Request, res: Response): Promise<void> {
    try {
      const keyContext = req.apiKey;
      if (!keyContext) {
        res.status(401).json({ error: 'Unauthorized', message: 'API key authentication required' });
        return;
      }

      const rawItems = Array.isArray(req.body?.logs)
        ? req.body.logs
        : Array.isArray(req.body)
          ? req.body
          : [req.body];

      const normalized: ValidatedTelemetryEvent[] = [];
      for (const item of rawItems) {
        const candidate = item?.type === 'log'
          ? item
          : {
              type: 'log',
              timestamp: item?.timestamp || new Date().toISOString(),
              serviceName: item?.serviceName,
              environment: item?.environment,
              data: {
                level: item?.level || 'info',
                message: item?.message,
                metadata: item?.metadata,
              },
            };

        const parsed = logEventSchema.safeParse(candidate);
        if (!parsed.success) {
          res.status(400).json({
            error: 'ValidationError',
            message: 'Invalid structured log payload',
            details: parsed.error.issues,
          });
          return;
        }
        normalized.push(parsed.data);
      }

      const result = await ingestService.ingestBatch(keyContext, normalized);
      res.status(202).json({ success: true, message: 'Logs accepted', data: result });
    } catch (error: any) {
      console.error('[IngestController.ingestLogs]:', error?.message || 'Unknown error');
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to ingest logs' });
    }
  }

  /**
   * POST /api/v1/ingest/metrics
   * Convenience endpoint for ingesting HTTP request metrics.
   */
  async ingestMetrics(req: Request, res: Response): Promise<void> {
    try {
      const keyContext = req.apiKey;
      if (!keyContext) {
        res.status(401).json({ error: 'Unauthorized', message: 'API key authentication required' });
        return;
      }

      const rawItems = Array.isArray(req.body?.metrics)
        ? req.body.metrics
        : Array.isArray(req.body)
          ? req.body
          : [req.body];

      const normalized: ValidatedTelemetryEvent[] = [];
      for (const item of rawItems) {
        const candidate = item?.type === 'http_request'
          ? item
          : {
              type: 'http_request',
              timestamp: item?.timestamp || new Date().toISOString(),
              serviceName: item?.serviceName,
              environment: item?.environment,
              data: {
                method: item?.method,
                route: item?.route,
                path: item?.path || item?.route,
                statusCode: item?.statusCode,
                durationMs: item?.durationMs,
                userAgent: item?.userAgent,
              },
            };

        const parsed = httpRequestEventSchema.safeParse(candidate);
        if (!parsed.success) {
          res.status(400).json({
            error: 'ValidationError',
            message: 'Invalid HTTP metric payload',
            details: parsed.error.issues,
          });
          return;
        }
        normalized.push(parsed.data);
      }

      const result = await ingestService.ingestBatch(keyContext, normalized);
      res.status(202).json({ success: true, message: 'Metrics accepted', data: result });
    } catch (error: any) {
      console.error('[IngestController.ingestMetrics]:', error?.message || 'Unknown error');
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to ingest metrics' });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId/applications/:applicationId/telemetry
   * Workspace-scoped read endpoint to inspect persisted telemetry.
   */
  async listTelemetry(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);
      const typeParam = req.query.type as string | undefined;
      const limitParam = req.query.limit ? Number(req.query.limit) : undefined;

      const app = await applicationService.getApplicationById(applicationId, workspaceId);
      if (!app) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Application not found in this workspace',
        });
        return;
      }

      let typeFilter: TelemetryEventType | undefined;
      if (typeParam) {
        const upper = typeParam.toUpperCase() as TelemetryEventType;
        if (!Object.values(TelemetryEventType).includes(upper)) {
          res.status(400).json({
            error: 'ValidationError',
            message: `Invalid type filter. Must be one of: ${Object.values(TelemetryEventType).join(', ')}`,
          });
          return;
        }
        typeFilter = upper;
      }

      const events = await ingestService.listTelemetryEvents(workspaceId, applicationId, {
        type: typeFilter,
        limit: limitParam,
      });

      res.status(200).json({
        success: true,
        data: {
          events,
          total: events.length,
        },
      });
    } catch (error: any) {
      console.error('[IngestController.listTelemetry]:', error?.message || 'Unknown error');
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to load telemetry' });
    }
  }
}

export const ingestController = new IngestController();
export default ingestController;
