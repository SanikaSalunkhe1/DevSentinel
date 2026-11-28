/**
 * DevSentinel — Workspace Module Integration Tests
 * ─────────────────────────────────────────────────
 * Tests run against a real database (uses seed data or creates its own).
 * Server runs on port 5098 to avoid collisions with the dev server (5000).
 *
 * Run: cd backend && npm run test:workspace
 */

import http from 'http';
import app from '../../app.js';
import prisma from '../../database/prisma.js';
import { WorkspaceRole } from '@prisma/client';
import crypto from 'crypto';

const TEST_PORT = 5098;
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
let ownerWorkspaceId: string;
let memberWorkspaceId: string;

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  // Create Owner user + workspace
  const ownerSub = `test-owner-${crypto.randomBytes(4).toString('hex')}`;
  const ownerEmail = `owner-${crypto.randomBytes(4).toString('hex')}@test.local`;

  const ownerUser = await prisma.user.create({
    data: { email: ownerEmail, name: 'Test Owner', googleSub: ownerSub },
  });

  const ownerWorkspace = await prisma.workspace.create({
    data: { name: "Owner's Test Workspace", slug: `owner-ws-${crypto.randomBytes(3).toString('hex')}` },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: ownerWorkspace.id, userId: ownerUser.id, role: WorkspaceRole.OWNER },
  });

  const ownerSession = await prisma.session.create({
    data: {
      userId: ownerUser.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  ownerToken = ownerSession.token;
  ownerWorkspaceId = ownerWorkspace.id;

  // Create Member user — added to same workspace as MEMBER
  const memberSub = `test-member-${crypto.randomBytes(4).toString('hex')}`;
  const memberEmail = `member-${crypto.randomBytes(4).toString('hex')}@test.local`;

  const memberUser = await prisma.user.create({
    data: { email: memberEmail, name: 'Test Member', googleSub: memberSub },
  });

  const memberWorkspace = await prisma.workspace.create({
    data: { name: "Member's Test Workspace", slug: `member-ws-${crypto.randomBytes(3).toString('hex')}` },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: memberWorkspace.id, userId: memberUser.id, role: WorkspaceRole.OWNER },
  });

  // Also add member to owner's workspace as MEMBER
  await prisma.workspaceMember.create({
    data: { workspaceId: ownerWorkspace.id, userId: memberUser.id, role: WorkspaceRole.MEMBER },
  });

  const memberSession = await prisma.session.create({
    data: {
      userId: memberUser.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  memberToken = memberSession.token;
  memberWorkspaceId = memberWorkspace.id;

  // Create Outsider user — not in any shared workspace
  const outsiderSub = `test-outsider-${crypto.randomBytes(4).toString('hex')}`;
  const outsiderEmail = `outsider-${crypto.randomBytes(4).toString('hex')}@test.local`;

  const outsiderUser = await prisma.user.create({
    data: { email: outsiderEmail, name: 'Test Outsider', googleSub: outsiderSub },
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
  // Clean test data: sessions, members, workspaces, users created by this run
  // All cascade-deletes from workspaces and users handle the rest
  await prisma.workspace.deleteMany({
    where: { slug: { startsWith: 'owner-ws-' } },
  });
  await prisma.workspace.deleteMany({
    where: { slug: { startsWith: 'member-ws-' } },
  });
  await prisma.workspace.deleteMany({
    where: { slug: { startsWith: 'updated-name-' } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@test.local' } },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  // ── 1. No auth → 401 ──────────────────────────────────────────────────────
  await test('Unauthenticated request to /workspaces is rejected (401)', async () => {
    const r = await request('GET', '/workspaces');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // ── 2. List workspaces ─────────────────────────────────────────────────────
  await test('Owner can list their workspaces', async () => {
    const r = await request('GET', '/workspaces', undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data.workspaces), 'Expected workspaces array');
    const ws = r.body.data.workspaces.find((w: any) => w.id === ownerWorkspaceId);
    assert(ws !== undefined, 'Owner workspace not in list');
    assert(ws.role === 'OWNER', `Expected role OWNER, got ${ws.role}`);
  });

  await test('Member can list their workspaces (sees both own + shared)', async () => {
    const r = await request('GET', '/workspaces', undefined, memberToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const ids = r.body.data.workspaces.map((w: any) => w.id);
    assert(ids.includes(memberWorkspaceId), 'Member workspace missing');
    assert(ids.includes(ownerWorkspaceId), 'Shared workspace missing from member list');
  });

  // ── 3. Get workspace by ID ─────────────────────────────────────────────────
  await test('Owner can get workspace detail by ID', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.workspace.id === ownerWorkspaceId, 'Wrong workspace returned');
    assert(r.body.data.workspace.currentUserRole === 'OWNER', 'Expected OWNER role');
    assert(Array.isArray(r.body.data.workspace.members), 'Members array missing');
  });

  await test('Member can get shared workspace detail by ID', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}`, undefined, memberToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.workspace.currentUserRole === 'MEMBER', 'Expected MEMBER role');
  });

  // ── 4. Outsider access is blocked ─────────────────────────────────────────
  await test('Outsider cannot access workspace they do not belong to (404)', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}`, undefined, outsiderToken);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('Outsider cannot access member list (403 via middleware)', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}/members`, undefined, outsiderToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  // ── 5. Get workspace by slug ───────────────────────────────────────────────
  await test('Can get workspace by slug', async () => {
    // First fetch the slug
    const detail = await request('GET', `/workspaces/${ownerWorkspaceId}`, undefined, ownerToken);
    const slug = detail.body.data.workspace.slug;
    const r = await request('GET', `/workspaces/slug/${slug}`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.workspace.slug === slug, 'Slug mismatch');
  });

  // ── 6. Update workspace (OWNER) ────────────────────────────────────────────
  await test('Owner can update workspace name', async () => {
    const r = await request(
      'PATCH',
      `/workspaces/${ownerWorkspaceId}`,
      { name: 'Updated Workspace Name' },
      ownerToken
    );
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.workspace.name === 'Updated Workspace Name', 'Name not updated');
  });

  await test('Owner can update workspace slug', async () => {
    const newSlug = `updated-name-${crypto.randomBytes(3).toString('hex')}`;
    const r = await request(
      'PATCH',
      `/workspaces/${ownerWorkspaceId}`,
      { slug: newSlug },
      ownerToken
    );
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.workspace.slug === newSlug, 'Slug not updated');
  });

  // ── 7. MEMBER cannot update workspace settings ─────────────────────────────
  await test('MEMBER cannot update workspace settings (403)', async () => {
    const r = await request(
      'PATCH',
      `/workspaces/${ownerWorkspaceId}`,
      { name: 'Hacked Name' },
      memberToken
    );
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── 8. Invalid slug format rejected ───────────────────────────────────────
  await test('Update with invalid slug format is rejected (400)', async () => {
    const r = await request(
      'PATCH',
      `/workspaces/${ownerWorkspaceId}`,
      { slug: 'INVALID SLUG!!!' },
      ownerToken
    );
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // ── 9. Empty update body rejected ─────────────────────────────────────────
  await test('Update with no fields is rejected (400)', async () => {
    const r = await request('PATCH', `/workspaces/${ownerWorkspaceId}`, {}, ownerToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // ── 10. List members ───────────────────────────────────────────────────────
  await test('Member can list workspace members', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}/members`, undefined, memberToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.data.total === 'number', 'Missing total');
    assert(r.body.data.total >= 2, `Expected >=2 members, got ${r.body.data.total}`);
  });

  // ── 11. Get own role ───────────────────────────────────────────────────────
  await test('Owner gets OWNER role from /my-role', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}/my-role`, undefined, ownerToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.role === 'OWNER', `Expected OWNER, got ${r.body.data.role}`);
  });

  await test('Member gets MEMBER role from /my-role', async () => {
    const r = await request('GET', `/workspaces/${ownerWorkspaceId}/my-role`, undefined, memberToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.role === 'MEMBER', `Expected MEMBER, got ${r.body.data.role}`);
  });

  // ── 12. Non-existent workspace ID ─────────────────────────────────────────
  await test('Non-existent workspace ID returns 403 (middleware) or 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const r = await request('GET', `/workspaces/${fakeId}`, undefined, ownerToken);
    assert(r.status === 403 || r.status === 404, `Expected 403 or 404, got ${r.status}`);
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================================');
  console.log('      DevSentinel Workspace Module Verification         ');
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
