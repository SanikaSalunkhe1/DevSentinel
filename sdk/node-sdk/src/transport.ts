import http from 'http';
import https from 'https';
import { TelemetryEvent } from './types';

export interface TransportOptions {
  endpoint: string;
  apiKey: string;
  maxRetries: number;
  retryBaseDelayMs: number;
  requestTimeoutMs: number;
  debug: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a batch of telemetry events to the DevSentinel ingestion endpoint
 * with exponential backoff retry handling.
 *
 * Guarantees it will NEVER throw an unhandled exception into the host application.
 */
export async function sendBatchWithRetry(
  events: TelemetryEvent[],
  options: TransportOptions
): Promise<boolean> {
  if (events.length === 0) return true;

  const body = JSON.stringify({ events });

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const statusCode = await postJson(options.endpoint, body, options);

      if (statusCode >= 200 && statusCode < 300) {
        return true;
      }

      // Do not retry 4xx errors (except 429 Too Many Requests)
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        if (options.debug) {
          console.warn(
            `[@devsentinel/node-sdk] Ingestion rejected batch with status ${statusCode}; dropping ${events.length} event(s).`
          );
        }
        return false;
      }

      // Transient 429 or 5xx — eligible for retry
      if (attempt < options.maxRetries) {
        const backoff = options.retryBaseDelayMs * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 50);
        await sleep(backoff + jitter);
      }
    } catch (err: any) {
      if (attempt < options.maxRetries) {
        const backoff = options.retryBaseDelayMs * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 50);
        await sleep(backoff + jitter);
      } else if (options.debug) {
        console.warn(
          `[@devsentinel/node-sdk] Failed to deliver ${events.length} event(s) after ${options.maxRetries + 1} attempts: ${err?.message || 'Unknown error'}`
        );
      }
    }
  }

  return false;
}

function postJson(
  endpoint: string,
  payload: string,
  options: TransportOptions
): Promise<number> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch (err) {
      reject(err);
      return;
    }

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        timeout: options.requestTimeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': options.apiKey,
          'User-Agent': '@devsentinel/node-sdk/0.1.0',
        },
      },
      (res) => {
        // Drain response body so socket is released cleanly
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${options.requestTimeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}
