import { Router } from 'express';
import { apiKeyController } from './apikey.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireWorkspaceMember } from '../../middleware/workspace.middleware.js';

const router = Router({ mergeParams: true });

// All key management routes require authentication + workspace membership
// Mounted at: /api/v1/workspaces/:workspaceId/applications/:applicationId/keys
router.use(requireAuth);
router.use(requireWorkspaceMember);

/**
 * POST /keys
 * Generate a new API key (returns raw key ONCE)
 */
router.post('/', apiKeyController.generateKey.bind(apiKeyController));

/**
 * GET /keys
 * List all keys for the application (prefix only, never raw)
 */
router.get('/', apiKeyController.listKeys.bind(apiKeyController));

/**
 * POST /keys/:keyId/revoke
 * Revoke a key (marks inactive)
 */
router.post('/:keyId/revoke', apiKeyController.revokeKey.bind(apiKeyController));

/**
 * POST /keys/:keyId/rotate
 * Rotate: revoke old, generate new (returns new raw key ONCE)
 */
router.post('/:keyId/rotate', apiKeyController.rotateKey.bind(apiKeyController));

/**
 * DELETE /keys/:keyId
 * Permanently delete a key
 */
router.delete('/:keyId', apiKeyController.deleteKey.bind(apiKeyController));

export default router;
