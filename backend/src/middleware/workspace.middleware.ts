import { Request, Response, NextFunction } from 'express';
import { WorkspaceRole } from '@prisma/client';
import { workspaceService } from '../modules/workspace/workspace.service.js';

/**
 * requireWorkspaceMember
 * ──────────────────────
 * Verifies the authenticated user is a member of the workspace specified
 * by `:workspaceId` in the route params. Attaches `req.workspaceRole`.
 *
 * Usage:
 *   router.get('/:workspaceId/data', requireAuth, requireWorkspaceMember, handler)
 */
export async function requireWorkspaceMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const workspaceId = req.params.workspaceId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!workspaceId) {
      res.status(400).json({ error: 'BadRequest', message: 'Missing workspaceId parameter' });
      return;
    }

    const role = await workspaceService.getMemberRole(workspaceId, userId);

    if (!role) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this workspace',
      });
      return;
    }

    // Attach role to request for downstream use
    req.workspaceRole = role;
    next();
  } catch (error: any) {
    console.error('[requireWorkspaceMember Error]:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Authorization check failed' });
  }
}

/**
 * requireWorkspaceRole
 * ─────────────────────
 * Factory middleware: requires the user to have AT LEAST the given role
 * in the workspace (OWNER > ADMIN > MEMBER).
 *
 * Usage:
 *   router.patch('/:workspaceId', requireAuth, requireWorkspaceRole(WorkspaceRole.ADMIN), handler)
 */
export function requireWorkspaceRole(minimumRole: WorkspaceRole) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.workspaceId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      if (!workspaceId) {
        res.status(400).json({ error: 'BadRequest', message: 'Missing workspaceId parameter' });
        return;
      }

      const hasRole = await workspaceService.hasMinimumRole(workspaceId, userId, minimumRole);

      if (!hasRole) {
        const roleNames: Record<WorkspaceRole, string> = {
          [WorkspaceRole.OWNER]: 'OWNER',
          [WorkspaceRole.ADMIN]: 'ADMIN or OWNER',
          [WorkspaceRole.MEMBER]: 'MEMBER, ADMIN, or OWNER',
        };
        res.status(403).json({
          error: 'InsufficientRole',
          message: `This action requires ${roleNames[minimumRole]} role`,
        });
        return;
      }

      // Attach role if not already set
      if (!req.workspaceRole) {
        const role = await workspaceService.getMemberRole(workspaceId, userId);
        req.workspaceRole = role ?? undefined;
      }

      next();
    } catch (error: any) {
      console.error('[requireWorkspaceRole Error]:', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Authorization check failed' });
    }
  };
}
