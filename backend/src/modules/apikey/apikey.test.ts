/**
 * DevSentinel — API Key Management Integration Tests
 * ──────────────────────────────────────────────────
 * Tests run against a real database on port 5096.
 *
 * Run: cd backend && npm run test:apikey
 */

import http from 'http';
import crypto from 'crypto';
import app from '../../app.js';
import prisma from '../../database/prisma.js';
import { WorkspaceRole } from '@prisma/client';

const TEST_PORT = 5096;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function request(
  method: string,
  path: string,
  body?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const url = new URL(BASE + path);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
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

let ownerToken: string;
let outsiderToken: string;
let workspaceId: string;
let applicationId: string;
let appId: string;

let generatedKeyId: string;
let generatedRawKey: string;
let rotatedKeyId: string;
let rotatedRawKey: string;

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  const rnd = crypto.randomBytes(4).toString('hex');

  const ownerUser = await prisma.user.create({
    data: { email: `keytest-owner-${rnd}@test.local`, name: 'Key Owner', googleSub: `key-owner-${rnd}` },
  });

  const workspace = await prisma.workspace.create({
    data: { name: 'Key Test Workspace', slug: `keytest-ws-${rnd}` },
  });
  workspaceId = workspace.id;

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: ownerUser.id, role: WorkspaceRole.OWNER },
  });

  const ownerSession = await prisma.session.create({
    data: {
      userId: ownerUser.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  ownerToken = ownerSession.token;

  const application = await prisma.application.create({
    data: {
      appId: `app_${rnd}`,
      workspaceId: workspace.id,
      name: 'Key Test App',
      language: 'TypeScript',
      framework: 'Express',
    },
  });
  applicationId = application.id;
  appId = application.appId;

  // Outsider
  const outsiderUser = await prisma.user.create({
    data: { email: `keytest-outsider-${rnd}@test.local`, name: 'Key Outsider', googleSub: `key-outsider-${rnd}` },
  });

  const outsiderSession = await prisma.session.create({
    data: {
      userId: outsiderUser.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  outsiderToken = outsiderSession.token;
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

async function teardown() {
  await prisma.apiKey.deleteMany({ where: { applicationId } });
  await prisma.application.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { slug: { startsWith: 'keytest-' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  const keysBase = `/workspaces/${workspaceId}/applications/${applicationId}/keys`;

  // 1. Authorization checks
  await test('Unauthenticated request to generate key is rejected (401)', async () => {
    const r = await request('POST', keysBase, { label: 'prod-key' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Outsider cannot generate key for another workspace app (403/404)', async () => {
    const r = await request('POST', keysBase, { label: 'rogue-key' }, { Authorization: `Bearer ${outsiderToken}` });
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  await test('Outsider cannot list keys for another workspace app (403/404)', async () => {
    const r = await request('GET', keysBase, undefined, { Authorization: `Bearer ${outsiderToken}` });
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  // 2. Validation
  await test('Generate key without label returns 400', async () => {
    const r = await request('POST', keysBase, {}, { Authorization: `Bearer ${ownerToken}` });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // 3. Key generation & one-time display
  await test('Owner can generate a cryptographically secure API key (shown once)', async () => {
    const r = await request('POST', keysBase, { label: 'production-key' }, { Authorization: `Bearer ${ownerToken}` });
    assert(r.status === 201, `Expected 201, got ${r.status}`);
    const key = r.body.data.key;
    assert(typeof key.rawKey === 'string' && key.rawKey.startsWith('dsk_'), 'rawKey should start with dsk_');
    assert(key.rawKey.length === 68, `Expected length 68 (dsk_ + 64 hex), got ${key.rawKey.length}`);
    assert(key.prefix === key.rawKey.substring(0, 8), 'Prefix mismatch');
    generatedKeyId = key.id;
    generatedRawKey = key.rawKey;
  });

  await test('Database stores only SHA-256 hash, never rawKey', async () => {
    const dbRow = await prisma.apiKey.findUnique({ where: { id: generatedKeyId } });
    assert(dbRow !== null, 'Key not found in DB');
    const expectedHash = crypto.createHash('sha256').update(generatedRawKey).digest('hex');
    assert(dbRow!.keyHash === expectedHash, 'DB keyHash does not match SHA-256 of rawKey');
    assert(dbRow!.keyHash !== generatedRawKey, 'Raw key must not be stored in DB');
  });

  await test('List keys never exposes rawKey or keyHash', async () => {
    const r = await request('GET', keysBase, undefined, { Authorization: `Bearer ${ownerToken}` });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.total === 1, `Expected 1 key, got ${r.body.data.total}`);
    const item = r.body.data.keys[0];
    assert(item.rawKey === undefined, 'rawKey must NOT be exposed in list');
    assert(item.keyHash === undefined, 'keyHash must NOT be exposed in list');
    assert(item.prefix === generatedRawKey.substring(0, 8), 'Prefix mismatch');
    assert(item.isActive === true, 'Key should be active');
  });

  // 4. Valid key validation
  await test('Valid API key passes /auth/validate-key', async () => {
    const r = await request('POST', '/auth/validate-key', { apiKey: generatedRawKey });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.applicationId === applicationId, 'applicationId mismatch');
    assert(r.body.data.workspaceId === workspaceId, 'workspaceId mismatch');
    assert(r.body.data.appId === appId, 'appId mismatch');
  });

  await test('Valid API key passes requireApiKey middleware via x-api-key header', async () => {
    const r = await request('GET', '/test/apikey-protected', undefined, { 'x-api-key': generatedRawKey });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.applicationId === applicationId, 'applicationId mismatch');
  });

  await test('Valid API key passes requireApiKey middleware via Bearer header', async () => {
    const r = await request('GET', '/test/apikey-protected', undefined, { Authorization: `Bearer ${generatedRawKey}` });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // 5. Invalid key validation
  await test('Invalid API key is rejected (401)', async () => {
    const r = await request('POST', '/auth/validate-key', { apiKey: 'dsk_0000000000000000000000000000000000000000000000000000000000000000' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Malformed API key is rejected by requireApiKey middleware (401)', async () => {
    const r = await request('GET', '/test/apikey-protected', undefined, { 'x-api-key': 'invalid_format' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Missing API key is rejected by requireApiKey middleware (401)', async () => {
    const r = await request('GET', '/test/apikey-protected');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // 6. Key rotation
  await test('Owner can rotate API key (revokes old, issues new)', async () => {
    const r = await request(
      'POST',
      `${keysBase}/${generatedKeyId}/rotate`,
      { label: 'production-key-v2' },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const newKey = r.body.data.key;
    assert(newKey.id !== generatedKeyId, 'Rotated key should have a new ID');
    assert(newKey.rawKey.startsWith('dsk_'), 'New rawKey should start with dsk_');
    assert(newKey.rawKey !== generatedRawKey, 'New rawKey must differ from old rawKey');
    assert(newKey.label === 'production-key-v2', 'Label mismatch');
    rotatedKeyId = newKey.id;
    rotatedRawKey = newKey.rawKey;
  });

  await test('Old key is rejected immediately after rotation (401)', async () => {
    const r = await request('POST', '/auth/validate-key', { apiKey: generatedRawKey });
    assert(r.status === 401, `Expected 401 for old rotated key, got ${r.status}`);
  });

  await test('New rotated key is accepted (200)', async () => {
    const r = await request('POST', '/auth/validate-key', { apiKey: rotatedRawKey });
    assert(r.status === 200, `Expected 200 for new rotated key, got ${r.status}`);
    assert(r.body.data.applicationId === applicationId, 'applicationId mismatch');
  });

  // 7. Key revocation
  await test('Outsider cannot revoke key (403/404)', async () => {
    const r = await request(
      'POST',
      `${keysBase}/${rotatedKeyId}/revoke`,
      undefined,
      { Authorization: `Bearer ${outsiderToken}` }
    );
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  await test('Owner can revoke API key', async () => {
    const r = await request(
      'POST',
      `${keysBase}/${rotatedKeyId}/revoke`,
      undefined,
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('Revoked key is rejected on validation and middleware (401)', async () => {
    const r1 = await request('POST', '/auth/validate-key', { apiKey: rotatedRawKey });
    assert(r1.status === 401, `Expected 401 from validate-key, got ${r1.status}`);

    const r2 = await request('GET', '/test/apikey-protected', undefined, { 'x-api-key': rotatedRawKey });
    assert(r2.status === 401, `Expected 401 from requireApiKey, got ${r2.status}`);
  });

  await test('Revoking an already-revoked key returns 404', async () => {
    const r = await request(
      'POST',
      `${keysBase}/${rotatedKeyId}/revoke`,
      undefined,
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================================');
  console.log('      DevSentinel API Key Module Verification           ');
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
