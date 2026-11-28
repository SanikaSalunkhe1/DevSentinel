import { Request, Response, NextFunction } from 'express';
import { workspaceService } from './workspace.service.js';
import { WorkspaceRole } from '@prisma/client';
import { config } from '../../config/index.js';

/**
 * Middleware that ensures the authenticated user is a member of the workspace
 * identified by the `workspaceId` param. It also populates `req.workspaceRole`
 * for downstream handlers.
 */
export async function requireWorkspaceMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workspaceId = String(req.params.workspaceId || '');
  const userId = req.user?.id;

  if (!workspaceId || !userId) {
    res.status(400).json({ error: 'BadRequest', message: 'Missing workspaceId or user info' });
    return;
  }

  const role = await workspaceService.getMemberRole(workspaceId, userId);

  if (!role) {
    // Not a member – hide existence (404) to avoid leaking workspace existence
    res.status(404).json({ error: 'NotFound', message: 'Workspace not found or you are not a member' });
    return;
  }

  // Attach role for controllers that need it (e.g., update authorisation)
  req.workspaceRole = role;
  next();
}
