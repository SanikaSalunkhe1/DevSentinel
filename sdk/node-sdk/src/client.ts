import {
  DevSentinelConfig,
  ExpressLikeRequest,
  ExpressLikeResponse,
  ExpressNextFunction,
  LogLevel,
  TelemetryEvent,
} from './types';
import { redactString, redactValue } from './redactor';
import { sendBatchWithRetry } from './transport';

const DEFAULT_ENDPOINT = 'http://localhost:5000/api/v1/ingest';

export class DevSentinelClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly serviceName?: string;
  private readonly environment?: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxQueueSize: number;
  private readonly requestTimeoutMs: number;
  private readonly redactKeys: string[];
  private readonly debugMode: boolean;

  private queue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private activeFlush: Promise<void> | null = null;
  private isShuttingDown = false;
  private sigintHandler?: () => void;
  private sigtermHandler?: () => void;

  constructor(config: DevSentinelConfig) {
    if (!config.apiKey || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
      throw new Error('[@devsentinel/node-sdk] apiKey is required in initializeDevSentinel()');
    }

    this.apiKey = config.apiKey.trim();
    this.endpoint = (config.endpoint || DEFAULT_ENDPOINT).trim();
    this.serviceName = config.serviceName;
    this.environment = config.environment;
    this.batchSize = Math.max(1, config.batchSize ?? 25);
    this.flushIntervalMs = Math.max(100, config.flushIntervalMs ?? 5000);
    this.maxRetries = Math.max(0, config.maxRetries ?? 3);
    this.retryBaseDelayMs = Math.max(10, config.retryBaseDelayMs ?? 250);
    this.maxQueueSize = Math.max(10, config.maxQueueSize ?? 1000);
    this.requestTimeoutMs = Math.max(500, config.requestTimeoutMs ?? 5000);
    this.redactKeys = config.redactKeys ?? [];
    this.debugMode = config.debug ?? false;

    this.startTimer();

    if (config.registerShutdownHooks !== false) {
      this.registerSignalHandlers();
    }
  }

  private startTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    // Do not prevent the Node.js event loop from exiting naturally
    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  private registerSignalHandlers(): void {
    const handleSignal = () => {
      void this.shutdown();
    };
    this.sigintHandler = handleSignal;
    this.sigtermHandler = handleSignal;
    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
  }

  private enqueue(event: TelemetryEvent): void {
    if (this.isShuttingDown) return;

    if (this.queue.length >= this.maxQueueSize) {
      // Drop oldest event to keep memory bounded
      this.queue.shift();
    }

    this.queue.push(event);

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  /**
   * Returns current number of queued (unflushed) telemetry events.
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Express request middleware: captures HTTP method, route, response status, and duration.
   * Never blocks or crashes the request lifecycle.
   */
  public requestMiddleware() {
    return (
      req: ExpressLikeRequest,
      res: ExpressLikeResponse,
      next: ExpressNextFunction
    ): void => {
      const startTime = process.hrtime.bigint();

      res.on('finish', () => {
        try {
          const durationNs = process.hrtime.bigint() - startTime;
          const durationMs = Number((Number(durationNs) / 1_000_000).toFixed(2));

          const routePath = req.route?.path
            ? `${req.baseUrl || ''}${req.route.path}`
            : req.path || req.url.split('?')[0] || '/';

          const rawUrl = req.originalUrl || req.url || '/';
          const rawUserAgent = req.headers?.['user-agent'];
          const userAgent = Array.isArray(rawUserAgent) ? rawUserAgent[0] : rawUserAgent;

          this.enqueue({
            type: 'http_request',
            timestamp: new Date().toISOString(),
            ...(this.serviceName && { serviceName: this.serviceName }),
            ...(this.environment && { environment: this.environment }),
            data: {
              method: req.method,
              route: routePath,
              path: redactString(rawUrl),
              statusCode: res.statusCode,
              durationMs,
              ...(userAgent && { userAgent }),
            },
          });
        } catch {
          // Never crash host application
        }
      });

      next();
    };
  }

  /**
   * Express error-handling middleware (4 arguments).
   * Captures the error and delegates immediately to `next(err)`.
   */
  public errorMiddleware() {
    return (
      err: unknown,
      req: ExpressLikeRequest,
      res: ExpressLikeResponse,
      next: ExpressNextFunction
    ): void => {
      try {
        const routePath = req.route?.path
          ? `${req.baseUrl || ''}${req.route.path}`
          : req.path || req.url.split('?')[0] || '/';

        this.captureError(err, {
          method: req.method,
          route: routePath,
          statusCode: res.statusCode >= 400 ? res.statusCode : 500,
        });
      } catch {
        // Never crash host application
      }

      next(err);
    };
  }

  /**
   * Captures an Error or unknown thrown value with optional context.
   */
  public captureError(
    err: unknown,
    context?: Record<string, unknown> & {
      method?: string;
      route?: string;
      statusCode?: number;
    }
  ): void {
    try {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const { method, route, statusCode, ...restContext } = context || {};

      const redactedContext =
        Object.keys(restContext).length > 0
          ? (redactValue(restContext, this.redactKeys) as Record<string, unknown>)
          : undefined;

      this.enqueue({
        type: 'error',
        timestamp: new Date().toISOString(),
        ...(this.serviceName && { serviceName: this.serviceName }),
        ...(this.environment && { environment: this.environment }),
        data: {
          name: errorObj.name || 'Error',
          message: redactString(errorObj.message || 'Unknown error'),
          ...(errorObj.stack && { stack: redactString(errorObj.stack) }),
          ...(method && { method }),
          ...(route && { route }),
          ...(statusCode !== undefined && { statusCode }),
          ...(redactedContext && { context: redactedContext }),
        },
      });
    } catch {
      // Never crash host application
    }
  }

  /**
   * Captures a custom structured log with automatic sensitive-field redaction.
   */
  public log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    try {
      const redactedMeta = metadata
        ? (redactValue(metadata, this.redactKeys) as Record<string, unknown>)
        : undefined;

      this.enqueue({
        type: 'log',
        timestamp: new Date().toISOString(),
        ...(this.serviceName && { serviceName: this.serviceName }),
        ...(this.environment && { environment: this.environment }),
        data: {
          level,
          message: redactString(message),
          ...(redactedMeta && { metadata: redactedMeta }),
        },
      });
    } catch {
      // Never crash host application
    }
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  /**
   * Flushes all currently queued events in batches.
   * Never throws if telemetry delivery fails.
   */
  public async flush(): Promise<void> {
    if (this.activeFlush) {
      await this.activeFlush;
      if (this.queue.length === 0) return;
    }

    if (this.queue.length === 0) return;

    const runFlush = async () => {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        await sendBatchWithRetry(batch, {
          endpoint: this.endpoint,
          apiKey: this.apiKey,
          maxRetries: this.maxRetries,
          retryBaseDelayMs: this.retryBaseDelayMs,
          requestTimeoutMs: this.requestTimeoutMs,
          debug: this.debugMode,
        });
      }
    };

    this.activeFlush = runFlush().finally(() => {
      this.activeFlush = null;
    });

    await this.activeFlush;
  }

  /**
   * Gracefully shuts down the SDK: stops the timer, removes signal listeners,
   * and flushes any remaining telemetry events.
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.sigintHandler) {
      process.removeListener('SIGINT', this.sigintHandler);
      this.sigintHandler = undefined;
    }
    if (this.sigtermHandler) {
      process.removeListener('SIGTERM', this.sigtermHandler);
      this.sigtermHandler = undefined;
    }

    await this.flush();
  }
}
