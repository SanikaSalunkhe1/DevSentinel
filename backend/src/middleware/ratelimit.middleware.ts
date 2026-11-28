import { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests allowed per window (default: 120) */
  maxRequests?: number;
}

/**
 * Lightweight in-memory rate limiter for telemetry ingestion.
 * Keys by verified `req.apiKey.applicationId` (falling back to client IP).
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 120;
  const buckets = new Map<string, RateLimitBucket>();

  // Periodic cleanup to avoid unbounded memory growth
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, windowMs);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const key =
      req.apiKey?.applicationId ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', String(Math.max(1, resetSeconds)));
      res.status(429).json({
        error: 'TooManyRequests',
        message: `Rate limit exceeded (${maxRequests} requests per ${Math.round(windowMs / 1000)}s).`,
        retryAfterSeconds: Math.max(1, resetSeconds),
      });
      return;
    }

    next();
  };
}
