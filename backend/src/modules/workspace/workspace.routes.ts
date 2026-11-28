import { Router } from 'express';
import { workspaceController } from './workspace.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireWorkspaceMember } from '../../middleware/workspace.middleware.js';

const router = Router();

// All workspace routes require authentication
router.use(requireAuth);

// ─── Workspace Collection ─────────────────────────────────────────────────────

/**
 * GET /api/v1/workspaces
 * List all workspaces the current user belongs to
 */
router.get('/', workspaceController.listWorkspaces.bind(workspaceController));

// ─── Workspace by Slug (must come before /:workspaceId to avoid "slug" matching as an ID) ───

/**
 * GET /api/v1/workspaces/slug/:slug
 * Find workspace by URL slug
 */
router.get('/slug/:slug', workspaceController.getWorkspaceBySlug.bind(workspaceController));

// ─── Workspace by ID ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/workspaces/:workspaceId
 * Get workspace detail (members, role, etc.)
 */
router.get(
  '/:workspaceId',
  requireWorkspaceMember,
  workspaceController.getWorkspace.bind(workspaceController)
);

/**
 * PATCH /api/v1/workspaces/:workspaceId
 * Update workspace name / slug (OWNER or ADMIN only — enforced in service)
 */
router.patch(
  '/:workspaceId',
  requireWorkspaceMember,
  workspaceController.updateWorkspace.bind(workspaceController)
);

/**
 * GET /api/v1/workspaces/:workspaceId/members
 * List all members of a workspace
 */
router.get(
  '/:workspaceId/members',
  requireWorkspaceMember,
  workspaceController.listMembers.bind(workspaceController)
);

/**
 * GET /api/v1/workspaces/:workspaceId/my-role
 * Get the current user's role in the workspace
 */
router.get(
  '/:workspaceId/my-role',
  requireWorkspaceMember,
  workspaceController.getMyRole.bind(workspaceController)
);

export default router;
