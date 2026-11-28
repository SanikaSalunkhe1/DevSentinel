/**
 * DevSentinel — Telemetry Ingestion Integration Tests
 * ────────────────────────────────────────────────────
 * Tests run against PostgreSQL on port 5095.
 *
 * Run: cd backend && npm run test:ingest
 */

import http from 'http';
import crypto from 'crypto';
import express from 'express';
import app from '../../app.js';
import prisma from '../../database/prisma.js';
import { WorkspaceRole } from '@prisma/client';
import { apiKeyService } from '../apikey/apikey.service.js';
import { createIngestRouter } from './ingest.routes.js';

const TEST_PORT = 5095;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function request(
  port: number,
  method: string,
  path: string,
  body?: object | string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: `/api/v1${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload !== undefined && { 'Content-Length': Buffer.byteLength(payload) }),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

let passed = 0;
let failed = 0;

async function test(label: string, fn: () => Promise<void>) {
  process.stdout.write(`TEST: ${label}... `);
  try {
    await fn();
    console.log('PASSED');
    passed++;
  } catch (err: any) {
    console.log(`FAILED — ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ─── Test State ───────────────────────────────────────────────────────────────

let workspaceAId: string;
let workspaceBId: string;
let appAId: string;
let appBId: string;
let tokenA: string;
let tokenB: string;
let apiKeyA: string;
let apiKeyB: string;
let revokedKeyA: string;

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

async function setup() {
  const rnd = crypto.randomBytes(4).toString('hex');

  const userA = await prisma.user.create({
    data: { email: `ingest-a-${rnd}@test.local`, name: 'Ingest User A', googleSub: `ing-a-${rnd}` },
  });
  const wsA = await prisma.workspace.create({
    data: { name: 'Ingest WS A', slug: `ingest-ws-a-${rnd}` },
  });
  workspaceAId = wsA.id;
  await prisma.workspaceMember.create({
    data: { workspaceId: wsA.id, userId: userA.id, role: WorkspaceRole.OWNER },
  });
  const sessA = await prisma.session.create({
    data: {
      userId: userA.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 86400_000),
    },
  });
  tokenA = sessA.token;

  const appA = await prisma.application.create({
    data: { appId: `app_a_${rnd}`, workspaceId: wsA.id, name: 'Service A' },
  });
  appAId = appA.id;

  const keyA = await apiKeyService.generateKey(appA.id, 'key-a');
  apiKeyA = keyA.rawKey;

  const revA = await apiKeyService.generateKey(appA.id, 'revoked-key-a');
  revokedKeyA = revA.rawKey;
  await apiKeyService.revokeKey(revA.id, appA.id);

  // Workspace B (isolated tenant)
  const userB = await prisma.user.create({
    data: { email: `ingest-b-${rnd}@test.local`, name: 'Ingest User B', googleSub: `ing-b-${rnd}` },
  });
  const wsB = await prisma.workspace.create({
    data: { name: 'Ingest WS B', slug: `ingest-ws-b-${rnd}` },
  });
  workspaceBId = wsB.id;
  await prisma.workspaceMember.create({
    data: { workspaceId: wsB.id, userId: userB.id, role: WorkspaceRole.OWNER },
  });
  const sessB = await prisma.session.create({
    data: {
      userId: userB.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 86400_000),
    },
  });
  tokenB = sessB.token;

  const appB = await prisma.application.create({
    data: { appId: `app_b_${rnd}`, workspaceId: wsB.id, name: 'Service B' },
  });
  appBId = appB.id;
  const keyB = await apiKeyService.generateKey(appB.id, 'key-b');
  apiKeyB = keyB.rawKey;
}

async function teardown() {
  await prisma.telemetryEvent.deleteMany({
    where: { workspaceId: { in: [workspaceAId, workspaceBId] } },
  });
  await prisma.apiKey.deleteMany({
    where: { applicationId: { in: [appAId, appBId] } },
  });
  await prisma.application.deleteMany({
    where: { workspaceId: { in: [workspaceAId, workspaceBId] } },
  });
  await prisma.workspace.deleteMany({
    where: { slug: { startsWith: 'ingest-ws-' } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@test.local' } },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  await test('Unauthenticated ingestion request is rejected (401)', async () => {
    const r = await request(TEST_PORT, 'POST', '/ingest', { events: [] });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Revoked API key is rejected (401)', async () => {
    const r = await request(
      TEST_PORT,
      'POST',
      '/ingest',
      {
        events: [
          {
            type: 'log',
            timestamp: new Date().toISOString(),
            data: { level: 'info', message: 'should fail' },
          },
        ],
      },
      { 'x-api-key': revokedKeyA }
    );
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Invalid payload is rejected with 400 ValidationError', async () => {
    const r = await request(
      TEST_PORT,
      'POST',
      '/ingest',
      {
        events: [
          {
            type: 'http_request',
            timestamp: 'not-a-date',
            data: { method: 'GET', route: '/', path: '/', statusCode: 999, durationMs: -5 },
          },
        ],
      },
      { 'x-api-key': apiKeyA }
    );
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Payload exceeding 512KB is rejected with 413 PayloadTooLarge', async () => {
    const hugeMessage = 'x'.repeat(600 * 1024);
    const r = await request(
      TEST_PORT,
      'POST',
      '/ingest',
      {
        events: [
          {
            type: 'log',
            timestamp: new Date().toISOString(),
            data: { level: 'info', message: hugeMessage },
          },
        ],
      },
      { 'x-api-key': apiKeyA }
    );
    assert(r.status === 413, `Expected 413, got ${r.status}`);
  });

  await test('Batch exceeding 100 events is rejected with 400', async () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      type: 'log',
      timestamp: new Date().toISOString(),
      data: { level: 'info', message: `log ${i}` },
    }));
    const r = await request(TEST_PORT, 'POST', '/ingest', { events }, { 'x-api-key': apiKeyA });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Valid batch ingestion persists events and updates connectionStatus & lastTelemetryAt', async () => {
    const r = await request(
      TEST_PORT,
      'POST',
      '/ingest',
      {
        events: [
          {
            type: 'http_request',
            timestamp: new Date().toISOString(),
            serviceName: 'service-a',
            environment: 'production',
            data: { method: 'GET', route: '/api/users', path: '/api/users', statusCode: 200, durationMs: 14.2 },
          },
          {
            type: 'log',
            timestamp: new Date().toISOString(),
            data: { level: 'info', message: 'User listed', metadata: { count: 5 } },
          },
          {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { name: 'TypeError', message: 'Cannot read property', statusCode: 500 },
          },
        ],
      },
      { 'x-api-key': apiKeyA }
    );

    assert(r.status === 202, `Expected 202, got ${r.status}`);
    assert(r.body.data.acceptedCount === 3, `Expected 3 accepted, got ${r.body.data.acceptedCount}`);
    assert(r.body.data.applicationId === appAId, 'applicationId mismatch');
    assert(r.body.data.workspaceId === workspaceAId, 'workspaceId mismatch');

    const updatedApp = await prisma.application.findUnique({ where: { id: appAId } });
    assert(updatedApp?.connectionStatus === 'CONNECTED', `Expected CONNECTED, got ${updatedApp?.connectionStatus}`);
    assert(updatedApp?.lastTelemetryAt !== null, 'lastTelemetryAt should be populated');
  });

  await test('POST /ingest/logs and /ingest/metrics accept structured logs and HTTP metrics', async () => {
    const rLog = await request(
      TEST_PORT,
      'POST',
      '/ingest/logs',
      { level: 'warn', message: 'Cache miss', metadata: { key: 'user:1' } },
      { 'x-api-key': apiKeyA }
    );
    assert(rLog.status === 202, `Expected 202 for /ingest/logs, got ${rLog.status}`);

    const rMetric = await request(
      TEST_PORT,
      'POST',
      '/ingest/metrics',
      { method: 'POST', route: '/api/pay', statusCode: 201, durationMs: 42.5 },
      { 'x-api-key': apiKeyA }
    );
    assert(rMetric.status === 202, `Expected 202 for /ingest/metrics, got ${rMetric.status}`);
  });

  await test('Workspace isolation: Tenant B cannot read Tenant A telemetry', async () => {
    // Ingest into B as well
    await request(
      TEST_PORT,
      'POST',
      '/ingest/logs',
      { level: 'info', message: 'Tenant B secret log' },
      { 'x-api-key': apiKeyB }
    );

    // Tenant B trying to read Tenant A's workspace/application telemetry
    const crossRead = await request(
      TEST_PORT,
      'GET',
      `/workspaces/${workspaceAId}/applications/${appAId}/telemetry`,
      undefined,
      { Authorization: `Bearer ${tokenB}` }
    );
    assert(crossRead.status === 403 || crossRead.status === 404, `Expected 403/404, got ${crossRead.status}`);

    // Tenant A reads own telemetry — must NOT see Tenant B logs
    const ownRead = await request(
      TEST_PORT,
      'GET',
      `/workspaces/${workspaceAId}/applications/${appAId}/telemetry`,
      undefined,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(ownRead.status === 200, `Expected 200, got ${ownRead.status}`);
    assert(ownRead.body.data.total === 5, `Expected 5 events in A, got ${ownRead.body.data.total}`);
    const hasB = ownRead.body.data.events.some((e: any) => e.message === 'Tenant B secret log');
    assert(!hasB, 'Tenant A must not see Tenant B telemetry');
  });

  await test('Rate limiting enforces 429 TooManyRequests when limit is exceeded', async () => {
    // Spin up isolated router with maxRequests: 2 for deterministic rate limit testing
    const rlApp = express();
    rlApp.use('/api/v1/ingest', createIngestRouter({ maxRequests: 2, windowMs: 60_000 }));
    const rlServer = await new Promise<http.Server>((resolve) => {
      const s = rlApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const rlPort = (rlServer.address() as { port: number }).port;

    try {
      const payload = {
        events: [{ type: 'log', timestamp: new Date().toISOString(), data: { level: 'info', message: 'rl' } }],
      };
      const r1 = await request(rlPort, 'POST', '/ingest', payload, { 'x-api-key': apiKeyA });
      const r2 = await request(rlPort, 'POST', '/ingest', payload, { 'x-api-key': apiKeyA });
      const r3 = await request(rlPort, 'POST', '/ingest', payload, { 'x-api-key': apiKeyA });

      assert(r1.status === 202, `Expected 202 on #1, got ${r1.status}`);
      assert(r2.status === 202, `Expected 202 on #2, got ${r2.status}`);
      assert(r3.status === 429, `Expected 429 on #3, got ${r3.status}`);
      assert(r3.headers['retry-after'] !== undefined, 'Missing Retry-After header');
    } finally {
      await new Promise<void>((resolve) => rlServer.close(() => resolve()));
    }
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================================');
  console.log('      DevSentinel Telemetry Ingestion Verification      ');
  console.log('========================================================');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Test Runner] Server started on port ${TEST_PORT}`);

  try {
    await setup();
    await runTests();
  } finally {
    await teardown();
    await prisma.$disconnect();
    server.close();
  }

  console.log('========================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[Fatal Test Error]:', err);
  process.exit(1);
});
