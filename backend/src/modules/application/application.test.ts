/**
 * DevSentinel — Application Registry Integration Tests
 * ─────────────────────────────────────────────────────
 * Tests run against a real database on port 5097.
 *
 * Run: cd backend && npm run test:app
 */

import http from 'http';
import app from '../../app.js';
import prisma from '../../database/prisma.js';
import { WorkspaceRole } from '@prisma/client';
import crypto from 'crypto';

const TEST_PORT = 5097;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function request(
  method: string,
  path: string,
  body?: object,
  token?: string
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
        ...(token && { Authorization: `Bearer ${token}` }),
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
let memberToken: string;
let outsiderToken: string;
let workspaceId: string;
let outsiderWorkspaceId: string;
let createdAppId: string;      // UUID
let createdAppAppId: string;   // human-readable "app_xxxx"

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  const rnd = crypto.randomBytes(4).toString('hex');

  // Owner
  const ownerUser = await prisma.user.create({
    data: { email: `apptest-owner-${rnd}@test.local`, name: 'App Owner', googleSub: `app-owner-${rnd}` },
  });

  const workspace = await prisma.workspace.create({
    data: { name: 'App Test Workspace', slug: `apptest-ws-${rnd}` },
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

  // Member (in same workspace)
  const memberUser = await prisma.user.create({
    data: { email: `apptest-member-${rnd}@test.local`, name: 'App Member', googleSub: `app-member-${rnd}` },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: memberUser.id, role: WorkspaceRole.MEMBER },
  });

  const memberSession = await prisma.session.create({
    data: {
      userId: memberUser.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  memberToken = memberSession.token;

  // Outsider (different workspace, NOT in the test workspace)
  const outsiderUser = await prisma.user.create({
    data: { email: `apptest-outsider-${rnd}@test.local`, name: 'App Outsider', googleSub: `app-outsider-${rnd}` },
  });

  const outsiderWs = await prisma.workspace.create({
    data: { name: 'Outsider Workspace', slug: `apptest-out-${rnd}` },
  });
  outsiderWorkspaceId = outsiderWs.id;

  await prisma.workspaceMember.create({
    data: { workspaceId: outsiderWs.id, userId: outsiderUser.id, role: WorkspaceRole.OWNER },
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
  await prisma.application.deleteMany({ where: { workspaceId } });
  await prisma.application.deleteMany({ where: { workspaceId: outsiderWorkspaceId } });
  await prisma.workspace.deleteMany({ where: { slug: { startsWith: 'apptest-' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  // 1. No auth → 401
  await test('Unauthenticated request to applications is rejected (401)', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications`);
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // 2. Outsider cannot list apps in workspace they don't belong to
  await test('Outsider cannot list applications in another workspace', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications`, undefined, outsiderToken);
    // requireWorkspaceMember returns 404 to hide workspace existence
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  // 3. Create application — validation errors
  await test('Create application with missing name returns 400', async () => {
    const r = await request('POST', `/workspaces/${workspaceId}/applications`, {}, ownerToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Create application with short name returns 400', async () => {
    const r = await request('POST', `/workspaces/${workspaceId}/applications`, { name: 'A' }, ownerToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Create application with invalid environment returns 400', async () => {
    const r = await request('POST', `/workspaces/${workspaceId}/applications`, {
      name: 'Test App',
      environment: 'INVALID',
    }, ownerToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // 4. Create application — success
  await test('Owner can register a new application', async () => {
    const r = await request('POST', `/workspaces/${workspaceId}/applications`, {
      name: 'Payment Service',
      description: 'Handles payment processing',
      language: 'TypeScript',
      framework: 'Express',
      environment: 'DEVELOPMENT',
    }, ownerToken);
    assert(r.status === 201, `Expected 201, got ${r.status}`);
    assert(r.body.data.application.name === 'Payment Service', 'Name mismatch');
    assert(r.body.data.application.appId.startsWith('app_'), `AppId should start with app_, got ${r.body.data.application.appId}`);
    assert(r.body.data.application.language === 'TypeScript', 'Language mismatch');
    assert(r.body.data.application.framework === 'Express', 'Framework mismatch');
    assert(r.body.data.application.environment === 'DEVELOPMENT', 'Environment mismatch');
    assert(r.body.data.application.status === 'ACTIVE', 'Status should default to ACTIVE');
    createdAppId = r.body.data.application.id;
    createdAppAppId = r.body.data.application.appId;
  });

  await test('Member can also register an application', async () => {
    const r = await request('POST', `/workspaces/${workspaceId}/applications`, {
      name: 'Auth Service',
      language: 'Go',
      framework: 'Gin',
      environment: 'STAGING',
    }, memberToken);
    assert(r.status === 201, `Expected 201, got ${r.status}`);
    assert(r.body.data.application.name === 'Auth Service', 'Name mismatch');
  });

  // 5. List applications
  await test('Owner can list applications in workspace', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data.applications), 'Expected array');
    assert(r.body.data.total >= 2, `Expected >=2 apps, got ${r.body.data.total}`);
  });

  // 6. Get application by UUID
  await test('Get application by UUID', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications/${createdAppId}`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.application.id === createdAppId, 'ID mismatch');
    assert(r.body.data.application.name === 'Payment Service', 'Name mismatch');
  });

  // 7. Get application by human-readable appId
  await test('Get application by appId (app_xxxx)', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications/${createdAppAppId}`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.application.appId === createdAppAppId, 'AppId mismatch');
  });

  // 8. Get non-existent application
  await test('Get non-existent application returns 404', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications/00000000-0000-0000-0000-000000000000`, undefined, ownerToken);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // 9. Update application
  await test('Owner can update application metadata', async () => {
    const r = await request('PATCH', `/workspaces/${workspaceId}/applications/${createdAppId}`, {
      name: 'Payment Service v2',
      description: 'Updated payment processor',
      environment: 'PRODUCTION',
    }, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.application.name === 'Payment Service v2', 'Name not updated');
    assert(r.body.data.application.environment === 'PRODUCTION', 'Environment not updated');
  });

  await test('Update with no fields returns 400', async () => {
    const r = await request('PATCH', `/workspaces/${workspaceId}/applications/${createdAppId}`, {}, ownerToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Can set application status to INACTIVE', async () => {
    const r = await request('PATCH', `/workspaces/${workspaceId}/applications/${createdAppId}`, {
      status: 'INACTIVE',
    }, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.application.status === 'INACTIVE', 'Status not updated');
  });

  // 10. Status filter on list
  await test('List applications with status filter', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications?status=ACTIVE`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    // Only the second app (Auth Service) should be ACTIVE now
    const allActive = r.body.data.applications.every((a: any) => a.status === 'ACTIVE');
    assert(allActive, 'Filter returned non-ACTIVE apps');
  });

  await test('Invalid status filter returns 400', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications?status=BOGUS`, undefined, ownerToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // 11. Outsider cannot access application in another workspace
  await test('Outsider cannot get application in another workspace', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications/${createdAppId}`, undefined, outsiderToken);
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  // 12. Outsider cannot create application in another workspace
  await test('Outsider cannot create application in another workspace', async () => {
    const r = await request('POST', `/workspaces/${workspaceId}/applications`, {
      name: 'Rogue App',
    }, outsiderToken);
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  // 13. Outsider cannot delete application in another workspace
  await test('Outsider cannot delete application in another workspace', async () => {
    const r = await request('DELETE', `/workspaces/${workspaceId}/applications/${createdAppId}`, undefined, outsiderToken);
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });

  // 14. Delete application — success
  await test('Owner can delete an application', async () => {
    const r = await request('DELETE', `/workspaces/${workspaceId}/applications/${createdAppId}`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('Deleted application is no longer found', async () => {
    const r = await request('GET', `/workspaces/${workspaceId}/applications/${createdAppId}`, undefined, ownerToken);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // 15. Delete non-existent application
  await test('Delete non-existent application returns 404', async () => {
    const r = await request('DELETE', `/workspaces/${workspaceId}/applications/00000000-0000-0000-0000-000000000000`, undefined, ownerToken);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // 16. Applications are workspace-scoped (outsider workspace has 0 apps)
  await test('Outsider workspace has zero applications', async () => {
    const r = await request('GET', `/workspaces/${outsiderWorkspaceId}/applications`, undefined, outsiderToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.total === 0, `Expected 0 apps, got ${r.body.data.total}`);
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================================');
  console.log('      DevSentinel Application Registry Verification     ');
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
