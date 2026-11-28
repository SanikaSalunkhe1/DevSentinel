import prisma from '../../database/prisma.js';
import { WorkspaceRole } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    id: string;
    role: WorkspaceRole;
    joinedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }[];
  currentUserRole: WorkspaceRole;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class WorkspaceService {
  /**
   * List all workspaces the authenticated user belongs to.
   */
  async listUserWorkspaces(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            members: true, // count only
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      joinedAt: m.joinedAt,
      memberCount: m.workspace.members.length,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
    }));
  }

  /**
   * Get a single workspace with full member list (caller must be a member).
   */
  async getWorkspaceById(workspaceId: string, requestingUserId: string): Promise<WorkspaceDetail | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!workspace) return null;

    // Verify requesting user is actually a member
    const membership = workspace.members.find((m) => m.userId === requestingUserId);
    if (!membership) return null;

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      members: workspace.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      currentUserRole: membership.role,
    };
  }

  /**
   * Get a workspace by slug (caller must be a member).
   */
  async getWorkspaceBySlug(slug: string, requestingUserId: string): Promise<WorkspaceDetail | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!workspace) return null;

    const membership = workspace.members.find((m) => m.userId === requestingUserId);
    if (!membership) return null;

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      members: workspace.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      currentUserRole: membership.role,
    };
  }

  /**
   * Update workspace name and/or slug.
   * Only OWNER or ADMIN may update workspace settings.
   */
  async updateWorkspace(
    workspaceId: string,
    requestingUserId: string,
    input: UpdateWorkspaceInput
  ): Promise<{ success: false; error: string } | { success: true; workspace: WorkspaceDetail }> {
    // Authorise: caller must be OWNER or ADMIN
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        uq_workspace_user: {
          workspaceId,
          userId: requestingUserId,
        },
      },
    });

    if (!membership) {
      return { success: false, error: 'NOT_MEMBER' };
    }
    if (membership.role === WorkspaceRole.MEMBER) {
      return { success: false, error: 'INSUFFICIENT_ROLE' };
    }

    // Validate slug uniqueness (if changing slug)
    if (input.slug) {
      const slugOwner = await prisma.workspace.findUnique({ where: { slug: input.slug } });
      if (slugOwner && slugOwner.id !== workspaceId) {
        return { success: false, error: 'SLUG_TAKEN' };
      }
    }

    // Apply update
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
      },
    });

    // Return full workspace detail
    const updated = await this.getWorkspaceById(workspaceId, requestingUserId);
    return { success: true, workspace: updated! };
  }

  /**
   * Get a user's role in a specific workspace. Returns null if not a member.
   */
  async getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        uq_workspace_user: {
          workspaceId,
          userId,
        },
      },
    });
    return membership?.role ?? null;
  }

  /**
   * Check whether a user has at least the required role in a workspace.
   * Role hierarchy: OWNER > ADMIN > MEMBER
   */
  async hasMinimumRole(
    workspaceId: string,
    userId: string,
    minimumRole: WorkspaceRole
  ): Promise<boolean> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) return false;

    const hierarchy: Record<WorkspaceRole, number> = {
      [WorkspaceRole.MEMBER]: 0,
      [WorkspaceRole.ADMIN]: 1,
      [WorkspaceRole.OWNER]: 2,
    };

    return hierarchy[role] >= hierarchy[minimumRole];
  }
}

export const workspaceService = new WorkspaceService();
export default workspaceService;
