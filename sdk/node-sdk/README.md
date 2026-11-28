# @devsentinel/node-sdk

Lightweight, zero-runtime-dependency Node.js & Express observability SDK for **DevSentinel**.

## Features

- **Express Request Middleware** — captures HTTP method, matched route, status code, and high-resolution duration (`ms`).
- **Express Error Middleware & Manual Capture** — captures unhandled Express errors and manual `captureError()` calls without interrupting error propagation.
- **Structured Logging** — `debug`, `info`, `warn`, `error` logs with structured metadata.
- **Automatic Sensitive Data Redaction** — recursively redacts `password`, `token`, `apiKey`, `authorization`, `cookie`, `dsk_...` keys, Bearer tokens, and sensitive query parameters.
- **Batching & Exponential Backoff Retries** — buffers events in memory, flushes by batch size or interval, and retries transient `429`/`5xx`/network failures.
- **Fail-Safe Delivery** — telemetry failures never throw or crash your application.
- **Graceful Shutdown** — flushes remaining queued events on `SIGINT`/`SIGTERM` or `shutdown()`.

---

## Installation

Inside this monorepo (npm workspaces):

```bash
npm install @devsentinel/node-sdk
```

---

## Quick Start (Express)

```ts
import express from 'express';
import {
  initializeDevSentinel,
  devSentinelMiddleware,
  devSentinelErrorMiddleware,
  log,
  shutdown,
} from '@devsentinel/node-sdk';

// 1. Initialize once at application startup
initializeDevSentinel({
  apiKey: process.env.DEVSENTINEL_API_KEY!,
  endpoint: process.env.DEVSENTINEL_ENDPOINT || 'http://localhost:5000/api/v1/ingest',
  serviceName: 'billing-service',
  environment: process.env.NODE_ENV || 'development',
});

const app = express();

// 2. Register request middleware BEFORE your routes
app.use(devSentinelMiddleware());

app.get('/api/health', (_req, res) => {
  log('info', 'Health check requested');
  res.json({ status: 'ok' });
});

// 3. Register error middleware AFTER your routes
app.use(devSentinelErrorMiddleware());

const server = app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

// Optional explicit graceful shutdown
process.on('SIGTERM', async () => {
  await shutdown();
  server.close();
});
```

---

## Configuration (`DevSentinelConfig`)

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **Required** | Application API key (`dsk_...`) from DevSentinel UI |
| `endpoint` | `string` | `http://localhost:5000/api/v1/ingest` | Telemetry ingestion endpoint URL |
| `serviceName` | `string` | `undefined` | Service identifier attached to events |
| `environment` | `string` | `undefined` | Environment tag (`development`, `staging`, `production`) |
| `batchSize` | `number` | `25` | Number of events per batch before auto-flush |
| `flushIntervalMs` | `number` | `5000` | Periodic flush interval in milliseconds |
| `maxRetries` | `number` | `3` | Retry attempts for transient `429`/`5xx`/network errors |
| `retryBaseDelayMs` | `number` | `250` | Base delay for exponential backoff |
| `maxQueueSize` | `number` | `1000` | Max queued events before dropping oldest |
| `requestTimeoutMs` | `number` | `5000` | HTTP request timeout in milliseconds |
| `redactKeys` | `string[]` | `[]` | Additional field names to redact |
| `debug` | `boolean` | `false` | Log internal SDK warnings to console |
| `registerShutdownHooks` | `boolean` | `true` | Auto-flush on `SIGINT`/`SIGTERM` |

---

## Building & Testing

```bash
cd sdk/node-sdk
npm run build
npm test
```

See [examples/express-app/server.ts](./examples/express-app/server.ts) for a complete runnable Express example.
