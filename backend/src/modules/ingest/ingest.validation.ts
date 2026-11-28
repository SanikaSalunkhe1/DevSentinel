import { z } from 'zod';

export const MAX_BATCH_EVENTS = 100;

const isoTimestampSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid ISO timestamp' });

export const httpRequestEventSchema = z.object({
  type: z.literal('http_request'),
  timestamp: isoTimestampSchema,
  serviceName: z.string().max(100).optional(),
  environment: z.string().max(50).optional(),
  data: z.object({
    method: z.string().min(1).max(16),
    route: z.string().min(1).max(512),
    path: z.string().min(1).max(1024),
    statusCode: z.number().int().min(100).max(599),
    durationMs: z.number().min(0).max(3_600_000),
    userAgent: z.string().max(512).optional(),
  }),
});

export const errorEventSchema = z.object({
  type: z.literal('error'),
  timestamp: isoTimestampSchema,
  serviceName: z.string().max(100).optional(),
  environment: z.string().max(50).optional(),
  data: z.object({
    name: z.string().min(1).max(255),
    message: z.string().min(1).max(4000),
    stack: z.string().max(16_000).optional(),
    method: z.string().max(16).optional(),
    route: z.string().max(512).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const logEventSchema = z.object({
  type: z.literal('log'),
  timestamp: isoTimestampSchema,
  serviceName: z.string().max(100).optional(),
  environment: z.string().max(50).optional(),
  data: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    message: z.string().min(1).max(4000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const telemetryEventSchema = z.discriminatedUnion('type', [
  httpRequestEventSchema,
  errorEventSchema,
  logEventSchema,
]);

export const ingestBatchSchema = z.object({
  events: z
    .array(telemetryEventSchema)
    .min(1, 'At least 1 telemetry event is required')
    .max(MAX_BATCH_EVENTS, `Batch cannot exceed ${MAX_BATCH_EVENTS} events`),
});

export type ValidatedTelemetryEvent = z.infer<typeof telemetryEventSchema>;
