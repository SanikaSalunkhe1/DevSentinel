import { Router } from 'express';
import { applicationController } from './application.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireWorkspaceMember } from '../../middleware/workspace.middleware.js';

const router = Router({ mergeParams: true });

// All application routes require authentication + workspace membership
// These routes are mounted under /api/v1/workspaces/:workspaceId/applications
router.use(requireAuth);
router.use(requireWorkspaceMember);

// ─── Application CRUD ────────────────────────────────────────────────────────

/**
 * POST /api/v1/workspaces/:workspaceId/applications
 * Register a new application
 */
router.post('/', applicationController.createApplication.bind(applicationController));

/**
 * GET /api/v1/workspaces/:workspaceId/applications
 * List all applications in the workspace
 */
router.get('/', applicationController.listApplications.bind(applicationController));

/**
 * GET /api/v1/workspaces/:workspaceId/applications/:applicationId
 * Get application details (supports UUID or appId like "app_a1b2c3d4")
 */
router.get('/:applicationId', applicationController.getApplication.bind(applicationController));

/**
 * PATCH /api/v1/workspaces/:workspaceId/applications/:applicationId
 * Update application metadata
 */
router.patch('/:applicationId', applicationController.updateApplication.bind(applicationController));

/**
 * DELETE /api/v1/workspaces/:workspaceId/applications/:applicationId
 * Delete an application
 */
router.delete('/:applicationId', applicationController.deleteApplication.bind(applicationController));

export default router;
