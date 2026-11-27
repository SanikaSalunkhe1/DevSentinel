import { PrismaClient, WorkspaceRole } from '@prisma/client';

const prisma = new PrismaClient();

async function runDatabaseTests() {
  console.log('====================================================');
  console.log('   DevSentinel Database Foundation Verification');
  console.log('====================================================');

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

  // TEST 1: User Query & Relationship
  await test('Query seeded user and memberships', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'sanika@devsentinel.local' },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
        sessions: true,
      },
    });

    if (!user) throw new Error('Seeded user not found');
    if (user.memberships.length === 0) throw new Error('User has no workspace memberships');
    if (user.sessions.length === 0) throw new Error('User has no active sessions');
  });

  // TEST 2: Workspace with Members Join Query
  await test('Query workspace and list members with roles', async () => {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: 'devsentinel-core' },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!workspace) throw new Error('Workspace not found');
    if (workspace.members.length < 2) throw new Error(`Expected >= 2 members, got ${workspace.members.length}`);

    const owner = workspace.members.find((m) => m.role === WorkspaceRole.OWNER);
    if (!owner) throw new Error('Workspace missing OWNER role member');
  });

  // TEST 3: Compound Unique Constraint Enforcement
  await test('Reject duplicate membership for same user and workspace', async () => {
    const workspace = await prisma.workspace.findUnique({ where: { slug: 'devsentinel-core' } });
    const user = await prisma.user.findUnique({ where: { email: 'sanika@devsentinel.local' } });

    if (!workspace || !user) throw new Error('Precondition failed');

    try {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.MEMBER,
        },
      });
      throw new Error('Database allowed duplicate (workspaceId, userId) membership!');
    } catch (err: any) {
      if (err.code === 'P2002') {
        // P2002 is Prisma's unique constraint violation code
        return;
      }
      throw err;
    }
  });

  // TEST 4: Session Token Lookup & Expiry Filter
  await test('Look up active valid session by token', async () => {
    const session = await prisma.session.findUnique({
      where: { token: 'devsentinel_session_token_dev_sample_abc123' },
      include: {
        user: true,
      },
    });

    if (!session) throw new Error('Session token not found');
    if (session.expiresAt <= new Date()) throw new Error('Session is expired unexpectedly');
    if (!session.user) throw new Error('Session user relation missing');
  });

  // TEST 5: Cascade Deletion Verification
  await test('Verify cascade deletion on temporary workspace', async () => {
    // Create temporary workspace & membership
    const tempUser = await prisma.user.create({
      data: {
        name: 'Temp Tester',
        email: 'temp.tester@test.local',
      },
    });

    const tempWorkspace = await prisma.workspace.create({
      data: {
        name: 'Ephemeral Workspace',
        slug: 'temp-workspace-' + Date.now(),
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: tempWorkspace.id,
        userId: tempUser.id,
        role: WorkspaceRole.OWNER,
      },
    });

    // Delete workspace
    await prisma.workspace.delete({
      where: { id: tempWorkspace.id },
    });

    // Verify membership was cascade-deleted
    const orphanedMemberships = await prisma.workspaceMember.findMany({
      where: { workspaceId: tempWorkspace.id },
    });

    if (orphanedMemberships.length > 0) {
      throw new Error('Cascade delete failed: orphaned memberships remained');
    }

    // Clean up temporary user
    await prisma.user.delete({ where: { id: tempUser.id } });
  });

  console.log('====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runDatabaseTests()
  .catch((e) => {
    console.error('Fatal Test Runner Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
