import crypto from 'crypto';
import prisma from '../../database/prisma.js';
import { WorkspaceRole } from '@prisma/client';
import { GooglePayload } from './google.client.js';
import { config } from '../../config/index.js';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
  workspaces: {
    id: string;
    name: string;
    slug: string;
    role: WorkspaceRole;
  }[];
  session: {
    token: string;
    expiresAt: Date;
  };
  isNewUser: boolean;
}

/**
 * Helper to generate URL-safe slug from workspace name
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'workspace'}-${randomSuffix}`;
}

export class AuthService {
  /**
   * Core logic: Authenticate a verified Google payload (handles new user registration & returning users)
   */
  async authenticateGoogleUser(
    payload: GooglePayload,
    clientInfo: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    const { sub, email, name, picture } = payload;

    // 1. Check if user already exists by googleSub or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleSub: sub },
          { email: email.toLowerCase() },
        ],
      },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });

    let isNewUser = false;

    if (!user) {
      // 2. NEW USER: Register user and create default workspace atomically in a transaction
      isNewUser = true;
      const workspaceName = `${name}'s Workspace`;
      const workspaceSlug = generateSlug(workspaceName);

      user = await prisma.$transaction(async (tx) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            name,
            avatarUrl: picture || null,
            googleSub: sub,
          },
        });

        // Create default workspace
        const newWorkspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            slug: workspaceSlug,
          },
        });

        // Assign user as OWNER
        await tx.workspaceMember.create({
          data: {
            workspaceId: newWorkspace.id,
            userId: newUser.id,
            role: WorkspaceRole.OWNER,
          },
        });

        // Return user with populated memberships
        return tx.user.findUniqueOrThrow({
          where: { id: newUser.id },
          include: {
            memberships: {
              include: {
                workspace: true,
              },
            },
          },
        });
      });
    } else {
      // 3. RETURNING USER: Update profile details if changed & link googleSub if previously missing
      const shouldUpdate = 
        user.googleSub !== sub ||
        user.name !== name ||
        (picture && user.avatarUrl !== picture);

      if (shouldUpdate) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleSub: sub,
            name,
            avatarUrl: picture || user.avatarUrl,
          },
          include: {
            memberships: {
              include: {
                workspace: true,
              },
            },
          },
        });
      }
    }

    // 4. Create secure server-managed session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.session.expiryDays);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        userAgent: clientInfo.userAgent || null,
        ipAddress: clientInfo.ipAddress || null,
        expiresAt,
      },
    });

    // 5. Structure return payload
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
      isNewUser,
    };
  }

  /**
   * Validate and retrieve session by token
   */
  async getSessionByToken(token: string) {
    if (!token) return null;

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                workspace: true,
              },
            },
          },
        },
      },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt <= new Date()) {
      // Purge expired session asynchronously
      prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return session;
  }

  /**
   * Invalidate / delete session by token
   */
  async revokeSession(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      await prisma.session.deleteMany({
        where: { token },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalidate all sessions for a specific user (e.g. on security reset)
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }
}

export const authService = new AuthService();
export default authService;
