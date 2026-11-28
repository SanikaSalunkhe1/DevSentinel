process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import { authService } from './auth.service.js';
import prisma from '../../database/prisma.js';
import app from '../../app.js';
import http from 'http';

let server: http.Server;
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

async function testAuthModule() {
  console.log('========================================================');
  console.log('      DevSentinel Authentication Module Verification     ');
  console.log('========================================================');

  // Start temporary server for HTTP route testing
  server = app.listen(PORT);
  console.log(`[Test Runner] Started test server on port ${PORT}`);

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`TEST: ${name}... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err: any) {
      console.log('FAILED');
      console.error(`      Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Protected route guard rejects unauthenticated requests
    // -------------------------------------------------------------------------
    await test('Protected route rejects request without session (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/test/protected`);
      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got status ${res.status}`);
      }
      const data = await res.json();
      if (data.error !== 'Unauthorized') {
        throw new Error(`Expected error 'Unauthorized', got '${data.error}'`);
      }
    });

    // -------------------------------------------------------------------------
    // TEST 2: Register New User & Automatically Create Default Workspace
    // -------------------------------------------------------------------------
    const testSub = 'google-sub-test-999001';
    const testEmail = 'neha.sharma.test@example.com';
    const testName = 'Neha Sharma';
    let sessionToken = '';

    await test('Register new user and create default workspace atomically', async () => {
      // Clean up test user if present
      await prisma.user.deleteMany({ where: { email: testEmail } });

      const res = await fetch(`${BASE_URL}/api/v1/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub: testSub,
          email: testEmail,
          name: testName,
          picture: 'https://example.com/avatar.png',
        }),
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${await res.text()}`);
      }

      const body = await res.json();
      if (!body.data.isNewUser) {
        throw new Error('Expected isNewUser to be true for first-time registration');
      }

      if (body.data.user.email !== testEmail) {
        throw new Error(`Expected email ${testEmail}, got ${body.data.user.email}`);
      }

      // Check default workspace creation
      if (!body.data.workspaces || body.data.workspaces.length === 0) {
        throw new Error('New user was not assigned a default workspace');
      }

      const workspace = body.data.workspaces[0];
      if (workspace.role !== 'OWNER') {
        throw new Error(`Expected workspace role OWNER, got ${workspace.role}`);
      }

      if (!body.data.session?.token) {
        throw new Error('No session token returned');
      }

      sessionToken = body.data.session.token;

      // Verify cookie was set in headers
      const setCookie = res.headers.get('set-cookie');
      if (!setCookie || !setCookie.includes('ds_session=')) {
        throw new Error('Response did not contain HTTP-only ds_session cookie');
      }
    });

    // -------------------------------------------------------------------------
    // TEST 3: Returning User Login Flow
    // -------------------------------------------------------------------------
    await test('Login returning user without duplicating workspace', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub: testSub,
          email: testEmail,
          name: 'Neha Sharma (Updated)',
          picture: 'https://example.com/new-avatar.png',
        }),
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}`);
      }

      const body = await res.json();
      if (body.data.isNewUser) {
        throw new Error('Expected isNewUser to be false for returning user');
      }

      if (body.data.user.name !== 'Neha Sharma (Updated)') {
        throw new Error('User profile name was not updated on return');
      }

      // Ensure workspaces didn't duplicate
      if (body.data.workspaces.length !== 1) {
        throw new Error(`Expected exactly 1 workspace, found ${body.data.workspaces.length}`);
      }

      // Update session token for subsequent tests
      sessionToken = body.data.session.token;
    });

    // -------------------------------------------------------------------------
    // TEST 4: Access Protected Route With Session (Bearer & Cookie)
    // -------------------------------------------------------------------------
    await test('Access /api/v1/auth/me using Bearer token authentication', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${await res.text()}`);
      }

      const body = await res.json();
      if (body.data.user.email !== testEmail) {
        throw new Error(`Expected authenticated user ${testEmail}, got ${body.data.user.email}`);
      }
    });

    await test('Access protected route using ds_session cookie', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/test/protected`, {
        headers: {
          Cookie: `ds_session=${sessionToken}`,
        },
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${await res.text()}`);
      }

      const body = await res.json();
      if (!body.success) {
        throw new Error('Protected route returned success: false');
      }
    });

    // -------------------------------------------------------------------------
    // TEST 5: Logout & Session Invalidation
    // -------------------------------------------------------------------------
    await test('Logout invalidates session and clears cookie', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `ds_session=${sessionToken}`,
        },
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}`);
      }

      // Verify session was removed from database
      const dbSession = await prisma.session.findUnique({
        where: { token: sessionToken },
      });

      if (dbSession) {
        throw new Error('Session was not purged from database after logout');
      }

      // Verify that accessing /auth/me now fails
      const checkRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: {
          Cookie: `ds_session=${sessionToken}`,
        },
      });

      if (checkRes.status !== 401) {
        throw new Error(`Expected 401 Unauthorized after logout, got ${checkRes.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // TEST 6: Reject malformed / missing Google Token
    // -------------------------------------------------------------------------
    await test('Reject malformed or empty token payload (400/401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.status !== 400) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      }

      const invalidTokenRes = await fetch(`${BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'invalid.fake.jwt-token' }),
      });

      if (invalidTokenRes.status !== 401) {
        throw new Error(`Expected 401 AuthenticationFailed, got ${invalidTokenRes.status}`);
      }
    });

    // Clean up test data
    await prisma.user.deleteMany({ where: { email: testEmail } });

  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log('========================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================');

  if (failed > 0) process.exit(1);
}

testAuthModule().catch((err) => {
  console.error('Fatal test runner failure:', err);
  if (server) server.close();
  process.exit(1);
});
