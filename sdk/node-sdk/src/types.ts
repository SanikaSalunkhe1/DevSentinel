export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TelemetryEventType = 'http_request' | 'error' | 'log';

export interface DevSentinelConfig {
  /** Application API key (e.g. "dsk_...") */
  apiKey: string;
  /** Ingestion endpoint URL (defaults to "http://localhost:5000/api/v1/ingest") */
  endpoint?: string;
  /** Optional service name tag */
  serviceName?: string;
  /** Optional environment tag (e.g. "production", "staging", "development") */
  environment?: string;
  /** Number of events per batch before auto-flush (default: 25) */
  batchSize?: number;
  /** Interval in ms between periodic flushes (default: 5000) */
  flushIntervalMs?: number;
  /** Maximum retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 250) */
  retryBaseDelayMs?: number;
  /** Maximum events held in memory before dropping oldest (default: 1000) */
  maxQueueSize?: number;
  /** HTTP request timeout in ms (default: 5000) */
  requestTimeoutMs?: number;
  /** Additional field names to redact from logs and error metadata */
  redactKeys?: string[];
  /** Enable internal SDK debug logging (default: false) */
  debug?: boolean;
  /** Automatically hook SIGINT/SIGTERM for graceful shutdown (default: true) */
  registerShutdownHooks?: boolean;
}

export interface HttpRequestEvent {
  type: 'http_request';
  timestamp: string;
  serviceName?: string;
  environment?: string;
  data: {
    method: string;
    route: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userAgent?: string;
  };
}

export interface ErrorEvent {
  type: 'error';
  timestamp: string;
  serviceName?: string;
  environment?: string;
  data: {
    name: string;
    message: string;
    stack?: string;
    method?: string;
    route?: string;
    statusCode?: number;
    context?: Record<string, unknown>;
  };
}

export interface LogEvent {
  type: 'log';
  timestamp: string;
  serviceName?: string;
  environment?: string;
  data: {
    level: LogLevel;
    message: string;
    metadata?: Record<string, unknown>;
  };
}

export type TelemetryEvent = HttpRequestEvent | ErrorEvent | LogEvent;

/** Structural Express-compatible types so the SDK has zero runtime dependencies */
export interface ExpressLikeRequest {
  method: string;
  url: string;
  originalUrl?: string;
  path?: string;
  baseUrl?: string;
  route?: { path?: string };
  headers?: Record<string, string | string[] | undefined>;
}

export interface ExpressLikeResponse {
  statusCode: number;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

export type ExpressNextFunction = (err?: unknown) => void;
