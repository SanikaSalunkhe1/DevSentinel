import prisma from '../../database/prisma.js';
import { ConnectionStatus, Prisma, TelemetryEventType } from '@prisma/client';
import { ValidatedKey } from '../apikey/apikey.service.js';
import { ValidatedTelemetryEvent } from './ingest.validation.js';

export interface IngestResult {
  acceptedCount: number;
  applicationId: string;
  workspaceId: string;
  receivedAt: Date;
}

export class IngestService {
  /**
   * Persists a validated batch of telemetry events strictly scoped to the
   * authenticated API key's workspace and application, and updates
   * `lastTelemetryAt` + `connectionStatus` on the application.
   */
  async ingestBatch(
    keyContext: ValidatedKey,
    events: ValidatedTelemetryEvent[]
  ): Promise<IngestResult> {
    const now = new Date();

    const rows: Prisma.TelemetryEventCreateManyInput[] = events.map((ev) => {
      const base = {
        workspaceId: keyContext.workspaceId,
        applicationId: keyContext.applicationId,
        apiKeyId: keyContext.keyId,
        timestamp: new Date(ev.timestamp),
        serviceName: ev.serviceName ?? null,
        environment: ev.environment ?? null,
        receivedAt: now,
      };

      if (ev.type === 'http_request') {
        return {
          ...base,
          type: TelemetryEventType.HTTP_REQUEST,
          method: ev.data.method.toUpperCase(),
          route: ev.data.route,
          path: ev.data.path,
          statusCode: ev.data.statusCode,
          durationMs: ev.data.durationMs,
          metadata: ev.data.userAgent
            ? ({ userAgent: ev.data.userAgent } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };
      }

      if (ev.type === 'error') {
        return {
          ...base,
          type: TelemetryEventType.ERROR,
          errorName: ev.data.name,
          message: ev.data.message,
          stack: ev.data.stack ?? null,
          method: ev.data.method?.toUpperCase() ?? null,
          route: ev.data.route ?? null,
          statusCode: ev.data.statusCode ?? null,
          metadata: ev.data.context
            ? (ev.data.context as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };
      }

      // Structured log
      return {
        ...base,
        type: TelemetryEventType.LOG,
        level: ev.data.level,
        message: ev.data.message,
        metadata: ev.data.metadata
          ? (ev.data.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      };
    });

    await prisma.$transaction([
      prisma.telemetryEvent.createMany({ data: rows }),
      prisma.application.update({
        where: { id: keyContext.applicationId },
        data: {
          lastTelemetryAt: now,
          connectionStatus: ConnectionStatus.CONNECTED,
        },
      }),
      prisma.apiKey.update({
        where: { id: keyContext.keyId },
        data: { lastUsedAt: now },
      }),
    ]);

    return {
      acceptedCount: rows.length,
      applicationId: keyContext.applicationId,
      workspaceId: keyContext.workspaceId,
      receivedAt: now,
    };
  }

  /**
   * Queries persisted telemetry events strictly scoped to `(workspaceId, applicationId)`.
   */
  async listTelemetryEvents(
    workspaceId: string,
    applicationId: string,
    options: { type?: TelemetryEventType; limit?: number } = {}
  ) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    return prisma.telemetryEvent.findMany({
      where: {
        workspaceId,
        applicationId,
        ...(options.type && { type: options.type }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}

export const ingestService = new IngestService();
export default ingestService;
