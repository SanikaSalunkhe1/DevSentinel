import { PrismaClient, WorkspaceRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[DevSentinel Seed] Starting database seeding...');

  // 1. Clean existing seed data if present
  console.log('[DevSentinel Seed] Cleaning existing data...');
  await prisma.session.deleteMany({});
  await prisma.workspaceMember.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create Primary Admin / Developer User
  console.log('[DevSentinel Seed] Creating developer user...');
  const devUser = await prisma.user.create({
    data: {
      email: 'sanika@devsentinel.local',
      name: 'Sanika Salunkhe',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sanika',
      googleSub: 'google-oauth-mock-sub-1001',
    },
  });
  console.log(`[DevSentinel Seed] Created user: ${devUser.name} (${devUser.email}) [ID: ${devUser.id}]`);

  // 3. Create Second Team Member
  const teamMember = await prisma.user.create({
    data: {
      email: 'alex.engineer@devsentinel.local',
      name: 'Alex Engineer',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
      googleSub: 'google-oauth-mock-sub-1002',
    },
  });
  console.log(`[DevSentinel Seed] Created user: ${teamMember.name} (${teamMember.email}) [ID: ${teamMember.id}]`);

  // 4. Create Workspaces
  console.log('[DevSentinel Seed] Creating default workspace...');
  const primaryWorkspace = await prisma.workspace.create({
    data: {
      name: 'DevSentinel Core Engineering',
      slug: 'devsentinel-core',
    },
  });
  console.log(`[DevSentinel Seed] Created workspace: ${primaryWorkspace.name} [ID: ${primaryWorkspace.id}]`);

  const stagingWorkspace = await prisma.workspace.create({
    data: {
      name: 'Staging & QA Team',
      slug: 'staging-qa',
    },
  });
  console.log(`[DevSentinel Seed] Created workspace: ${stagingWorkspace.name} [ID: ${stagingWorkspace.id}]`);

  // 5. Assign Memberships
  console.log('[DevSentinel Seed] Assigning workspace memberships...');
  const membership1 = await prisma.workspaceMember.create({
    data: {
      workspaceId: primaryWorkspace.id,
      userId: devUser.id,
      role: WorkspaceRole.OWNER,
    },
  });

  const membership2 = await prisma.workspaceMember.create({
    data: {
      workspaceId: primaryWorkspace.id,
      userId: teamMember.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  const membership3 = await prisma.workspaceMember.create({
    data: {
      workspaceId: stagingWorkspace.id,
      userId: devUser.id,
      role: WorkspaceRole.ADMIN,
    },
  });

  console.log(`[DevSentinel Seed] Assigned memberships: OWNER (${devUser.name}), MEMBER (${teamMember.name})`);

  // 6. Create Active Session
  console.log('[DevSentinel Seed] Creating active developer session...');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const session = await prisma.session.create({
    data: {
      userId: devUser.id,
      token: 'devsentinel_session_token_dev_sample_abc123',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
      ipAddress: '127.0.0.1',
      expiresAt: expiresAt,
    },
  });
  console.log(`[DevSentinel Seed] Created session for user: ${devUser.name} [Expires: ${session.expiresAt.toISOString()}]`);

  console.log('[DevSentinel Seed] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[DevSentinel Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
