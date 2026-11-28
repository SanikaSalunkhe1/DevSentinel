/**
 * @devsentinel/node-sdk — Unit & Integration Tests
 * Run: npm test --workspace=@devsentinel/node-sdk
 */

import http from 'http';
import express from 'express';
import {
  initializeDevSentinel,
  devSentinelMiddleware,
  devSentinelErrorMiddleware,
  captureError,
  log,
  shutdown,
  redactValue,
  redactString,
  TelemetryEvent,
} from '../index';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  process.stdout.write(`TEST: ${name}... `);
  try {
    await fn();
    console.log('PASSED');
    passed++;
  } catch (err: any) {
    console.log(`FAILED — ${err.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// ─── Mock Ingestion Server ────────────────────────────────────────────────────

interface ReceivedBatch {
  apiKey: string | undefined;
  events: TelemetryEvent[];
}

function createMockIngestionServer(
  handler?: (req: http.IncomingMessage, body: any, res: http.ServerResponse) => void
) {
  const batches: ReceivedBatch[] = [];

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const parsed = raw ? JSON.parse(raw) : {};
      if (handler) {
        handler(req, parsed, res);
        return;
      }
      batches.push({
        apiKey: req.headers['x-api-key'] as string | undefined,
        events: parsed.events || [],
      });
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });
  });

  return {
    batches,
    start: () =>
      new Promise<number>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as { port: number };
          resolve(addr.port);
        });
      }),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function httpGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n========================================================');
  console.log('      @devsentinel/node-sdk Verification Suite          ');
  console.log('========================================================');

  await test('initializeDevSentinel throws if apiKey is missing', () => {
    let threw = false;
    try {
      initializeDevSentinel({ apiKey: '' });
    } catch {
      threw = true;
    }
    assert(threw, 'Expected error when apiKey is empty');
  });

  await test('Redacts sensitive object keys, strings, URLs, and circular refs', () => {
    const circular: Record<string, unknown> = {
      username: 'alice',
      password: 'super-secret-password',
      nested: {
        authorization: 'Bearer abc.def.ghi',
        customSecret: 'hide-me',
        safeField: 'visible',
      },
      rawText: 'Used key dsk_1234567890abcdef1234567890abcdef and Bearer mytoken123',
    };
    circular.self = circular;

    const redacted = redactValue(circular, ['customSecret']) as any;
    assert(redacted.username === 'alice', 'Safe field should remain');
    assert(redacted.password === '[REDACTED]', 'password should be redacted');
    assert(redacted.nested.authorization === '[REDACTED]', 'authorization should be redacted');
    assert(redacted.nested.customSecret === '[REDACTED]', 'custom redactKey should be redacted');
    assert(redacted.nested.safeField === 'visible', 'nested safe field should remain');
    assert(!redacted.rawText.includes('dsk_123456'), 'dsk_ key in string should be redacted');
    assert(!redacted.rawText.includes('mytoken123'), 'Bearer token in string should be redacted');
    assert(redacted.self === '[Circular]', 'Circular reference should be handled safely');

    const redactedUrl = redactString('/login?token=secret123&user=bob');
    assert(redactedUrl === '/login?token=[REDACTED]&user=bob', `Unexpected URL: ${redactedUrl}`);
  });

  await test('Express middlewares capture HTTP method, route, status, duration, errors, and logs', async () => {
    const mock = createMockIngestionServer();
    const ingestPort = await mock.start();

    const client = initializeDevSentinel({
      apiKey: 'dsk_test_11112222333344445555666677778888',
      endpoint: `http://127.0.0.1:${ingestPort}/api/v1/ingest`,
      serviceName: 'orders-api',
      environment: 'test',
      batchSize: 10,
      flushIntervalMs: 60_000,
      registerShutdownHooks: false,
    });

    const app = express();
    app.use(devSentinelMiddleware());

    app.get('/api/orders/:id', (_req, res) => {
      log('info', 'Fetched order', { orderId: 'ord_1', api_key: 'should-redact' });
      res.status(200).json({ ok: true });
    });

    app.get('/api/fail', () => {
      throw new Error('Database timeout with Bearer secret_jwt_token');
    });

    app.use(devSentinelErrorMiddleware());
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });

    const appServer = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const appPort = (appServer.address() as { port: number }).port;

    try {
      const r1 = await httpGet(appPort, '/api/orders/42?token=abc');
      assert(r1.status === 200, `Expected 200, got ${r1.status}`);

      const r2 = await httpGet(appPort, '/api/fail');
      assert(r2.status === 500, `Expected 500, got ${r2.status}`);

      captureError(new Error('Manual error'), { userId: 'u_1', password: 'pw' });

      await client.flush();

      assert(mock.batches.length === 1, `Expected 1 batch, got ${mock.batches.length}`);
      assert(
        mock.batches[0].apiKey === 'dsk_test_11112222333344445555666677778888',
        'x-api-key header mismatch'
      );

      const events = mock.batches[0].events;
      const httpEvents = events.filter((e) => e.type === 'http_request');
      const logEvents = events.filter((e) => e.type === 'log');
      const errorEvents = events.filter((e) => e.type === 'error');

      assert(httpEvents.length === 2, `Expected 2 http_request events, got ${httpEvents.length}`);
      assert(httpEvents[0].data.method === 'GET', 'Method mismatch');
      assert(httpEvents[0].data.route === '/api/orders/:id', `Route mismatch: ${httpEvents[0].data.route}`);
      assert(httpEvents[0].data.statusCode === 200, 'Status mismatch');
      assert(typeof httpEvents[0].data.durationMs === 'number', 'Duration missing');
      assert(httpEvents[0].data.path.includes('token=[REDACTED]'), 'Query token not redacted');

      assert(logEvents.length === 1, 'Expected 1 log event');
      assert(logEvents[0].data.metadata?.api_key === '[REDACTED]', 'Log metadata api_key not redacted');

      assert(errorEvents.length === 2, `Expected 2 error events, got ${errorEvents.length}`);
      assert(!errorEvents[0].data.message.includes('secret_jwt_token'), 'Bearer token in error not redacted');
      assert(errorEvents[1].data.context?.password === '[REDACTED]', 'Error context password not redacted');
    } finally {
      await shutdown();
      await new Promise<void>((resolve) => appServer.close(() => resolve()));
      await mock.stop();
    }
  });

  await test('Batching triggers automatically when batchSize is reached', async () => {
    const mock = createMockIngestionServer();
    const ingestPort = await mock.start();

    const client = initializeDevSentinel({
      apiKey: 'dsk_batch_key',
      endpoint: `http://127.0.0.1:${ingestPort}/ingest`,
      batchSize: 3,
      flushIntervalMs: 60_000,
      registerShutdownHooks: false,
    });

    try {
      client.info('msg 1');
      client.info('msg 2');
      assert(client.getQueueSize() === 2, 'Expected 2 queued before batchSize');

      client.info('msg 3'); // triggers auto-flush
      await new Promise((r) => setTimeout(r, 100));

      assert(mock.batches.length === 1, `Expected 1 auto-flushed batch, got ${mock.batches.length}`);
      assert(mock.batches[0].events.length === 3, 'Expected 3 events in batch');
    } finally {
      await client.shutdown();
      await mock.stop();
    }
  });

  await test('Retries transient 503 errors and succeeds on subsequent attempt', async () => {
    let attempts = 0;
    const mock = createMockIngestionServer((_req, _body, res) => {
      attempts++;
      if (attempts < 3) {
        res.writeHead(503);
        res.end('Service Unavailable');
      } else {
        res.writeHead(200);
        res.end('OK');
      }
    });
    const ingestPort = await mock.start();

    const client = initializeDevSentinel({
      apiKey: 'dsk_retry_key',
      endpoint: `http://127.0.0.1:${ingestPort}/ingest`,
      maxRetries: 3,
      retryBaseDelayMs: 20,
      flushIntervalMs: 60_000,
      registerShutdownHooks: false,
    });

    try {
      client.warn('transient test');
      await client.flush();
      assert(attempts === 3, `Expected 3 attempts, got ${attempts}`);
    } finally {
      await client.shutdown();
      await mock.stop();
    }
  });

  await test('Never crashes host app when ingestion endpoint is unreachable', async () => {
    const client = initializeDevSentinel({
      apiKey: 'dsk_offline_key',
      endpoint: 'http://127.0.0.1:59999/unreachable',
      maxRetries: 1,
      retryBaseDelayMs: 10,
      requestTimeoutMs: 500,
      flushIntervalMs: 60_000,
      registerShutdownHooks: false,
    });

    client.error('offline event');
    await client.flush(); // Must resolve cleanly without throwing
    await client.shutdown();
    assert(true, 'Reached end without crashing');
  });

  await test('Graceful shutdown flushes remaining queued events', async () => {
    const mock = createMockIngestionServer();
    const ingestPort = await mock.start();

    const client = initializeDevSentinel({
      apiKey: 'dsk_shutdown_key',
      endpoint: `http://127.0.0.1:${ingestPort}/ingest`,
      batchSize: 50,
      flushIntervalMs: 60_000,
      registerShutdownHooks: false,
    });

    client.info('final log before exit');
    assert(client.getQueueSize() === 1, 'Expected 1 queued event');

    await client.shutdown();
    assert(client.getQueueSize() === 0, 'Queue should be empty after shutdown');
    assert(mock.batches.length === 1, 'Shutdown should flush remaining events');
    await mock.stop();
  });

  console.log('========================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('[Fatal SDK Test Error]:', err);
  process.exit(1);
});
