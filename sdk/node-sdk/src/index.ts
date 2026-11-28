import { DevSentinelClient } from './client';
import {
  DevSentinelConfig,
  ExpressLikeRequest,
  ExpressLikeResponse,
  ExpressNextFunction,
  LogLevel,
} from './types';

export * from './types';
export { DevSentinelClient } from './client';
export { redactValue, redactString } from './redactor';

let defaultClient: DevSentinelClient | null = null;

/**
 * Initializes the DevSentinel Node.js SDK and returns the client instance.
 */
export function initializeDevSentinel(config: DevSentinelConfig): DevSentinelClient {
  if (defaultClient) {
    // Cleanly stop any previous timer/hooks before re-initializing
    void defaultClient.shutdown();
  }
  defaultClient = new DevSentinelClient(config);
  return defaultClient;
}

export function getDevSentinelClient(): DevSentinelClient | null {
  return defaultClient;
}

/**
 * Express request middleware using the initialized DevSentinel client.
 */
export function devSentinelMiddleware() {
  return (
    req: ExpressLikeRequest,
    res: ExpressLikeResponse,
    next: ExpressNextFunction
  ): void => {
    if (!defaultClient) {
      next();
      return;
    }
    defaultClient.requestMiddleware()(req, res, next);
  };
}

/**
 * Express error middleware using the initialized DevSentinel client.
 */
export function devSentinelErrorMiddleware() {
  return (
    err: unknown,
    req: ExpressLikeRequest,
    res: ExpressLikeResponse,
    next: ExpressNextFunction
  ): void => {
    if (!defaultClient) {
      next(err);
      return;
    }
    defaultClient.errorMiddleware()(err, req, res, next);
  };
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  defaultClient?.captureError(err, context);
}

export function log(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void {
  defaultClient?.log(level, message, metadata);
}

export async function flush(): Promise<void> {
  if (defaultClient) {
    await defaultClient.flush();
  }
}

export async function shutdown(): Promise<void> {
  if (defaultClient) {
    await defaultClient.shutdown();
    defaultClient = null;
  }
}
