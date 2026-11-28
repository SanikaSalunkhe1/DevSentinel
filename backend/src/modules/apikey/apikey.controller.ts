import { Request, Response } from 'express';
import { apiKeyService } from './apikey.service.js';
import { applicationService } from '../application/application.service.js';

export class ApiKeyController {
  /**
   * POST /api/v1/workspaces/:workspaceId/applications/:applicationId/keys
   * Generate a new API key. Returns the raw key ONCE.
   */
  async generateKey(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);
      const { label, expiresAt } = req.body;

      // Validate label
      if (!label || typeof label !== 'string' || label.trim().length < 1) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'A label is required for the API key (e.g. "production-key-1")',
        });
        return;
      }

      if (label.trim().length > 100) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Label must not exceed 100 characters',
        });
        return;
      }

      // Verify application belongs to this workspace
      const app = await applicationService.getApplicationById(applicationId, workspaceId);
      if (!app) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Application not found in this workspace',
        });
        return;
      }

      // Parse optional expiry
      let expiry: Date | undefined;
      if (expiresAt) {
        expiry = new Date(expiresAt);
        if (isNaN(expiry.getTime()) || expiry <= new Date()) {
          res.status(400).json({
            error: 'ValidationError',
            message: 'expiresAt must be a valid future date',
          });
          return;
        }
      }

      const result = await apiKeyService.generateKey(applicationId, label.trim(), expiry);

      res.status(201).json({
        success: true,
        message: 'API key generated successfully. Store the key securely — it will NOT be shown again.',
        data: {
          key: {
            id: result.id,
            label: result.label,
            prefix: result.prefix,
            rawKey: result.rawKey,  // ← shown ONCE
            createdAt: result.createdAt,
            expiresAt: result.expiresAt,
          },
        },
      });
    } catch (error: any) {
      console.error('[ApiKeyController.generateKey]:', error);
      if (error.message === 'APPLICATION_NOT_FOUND') {
        res.status(404).json({ error: 'NotFound', message: 'Application not found' });
        return;
      }
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId/applications/:applicationId/keys
   * List all API keys for an application (prefix only, never raw keys).
   */
  async listKeys(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);

      // Verify application belongs to workspace
      const app = await applicationService.getApplicationById(applicationId, workspaceId);
      if (!app) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Application not found in this workspace',
        });
        return;
      }

      const keys = await apiKeyService.listKeys(applicationId);

      res.status(200).json({
        success: true,
        data: {
          keys,
          total: keys.length,
        },
      });
    } catch (error: any) {
      console.error('[ApiKeyController.listKeys]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/v1/workspaces/:workspaceId/applications/:applicationId/keys/:keyId/revoke
   * Revoke an API key (marks it inactive).
   */
  async revokeKey(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);
      const keyId = String(req.params.keyId);

      // Verify application belongs to workspace
      const app = await applicationService.getApplicationById(applicationId, workspaceId);
      if (!app) {
        res.status(404).json({ error: 'NotFound', message: 'Application not found in this workspace' });
        return;
      }

      const revoked = await apiKeyService.revokeKey(keyId, applicationId);

      if (!revoked) {
        res.status(404).json({
          error: 'NotFound',
          message: 'API key not found or already revoked',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'API key revoked successfully',
      });
    } catch (error: any) {
      console.error('[ApiKeyController.revokeKey]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/v1/workspaces/:workspaceId/applications/:applicationId/keys/:keyId/rotate
   * Rotate an API key: revokes the old one and generates a new one.
   * Returns the new raw key ONCE.
   */
  async rotateKey(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);
      const keyId = String(req.params.keyId);
      const { label } = req.body;

      // Verify application belongs to workspace
      const app = await applicationService.getApplicationById(applicationId, workspaceId);
      if (!app) {
        res.status(404).json({ error: 'NotFound', message: 'Application not found in this workspace' });
        return;
      }

      const result = await apiKeyService.rotateKey(keyId, applicationId, label);

      if (!result) {
        res.status(404).json({
          error: 'NotFound',
          message: 'API key not found or already revoked',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'API key rotated successfully. Store the NEW key securely — it will NOT be shown again.',
        data: {
          key: {
            id: result.id,
            label: result.label,
            prefix: result.prefix,
            rawKey: result.rawKey,
            createdAt: result.createdAt,
            expiresAt: result.expiresAt,
          },
        },
      });
    } catch (error: any) {
      console.error('[ApiKeyController.rotateKey]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/v1/auth/validate-key
   * Validate an API key (used by SDKs/services to authenticate).
   * Does NOT require session auth — this IS the authentication.
   */
  async validateKey(req: Request, res: Response): Promise<void> {
    try {
      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== 'string') {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Missing apiKey in request body',
        });
        return;
      }

      const result = await apiKeyService.validateKey(apiKey);

      if (!result) {
        res.status(401).json({
          error: 'InvalidApiKey',
          message: 'Invalid, revoked, or expired API key',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          applicationId: result.applicationId,
          workspaceId: result.workspaceId,
          appId: result.appId,
        },
      });
    } catch (error: any) {
      console.error('[ApiKeyController.validateKey]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * DELETE /api/v1/workspaces/:workspaceId/applications/:applicationId/keys/:keyId
   * Permanently delete an API key.
   */
  async deleteKey(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);
      const keyId = String(req.params.keyId);

      const app = await applicationService.getApplicationById(applicationId, workspaceId);
      if (!app) {
        res.status(404).json({ error: 'NotFound', message: 'Application not found in this workspace' });
        return;
      }

      const deleted = await apiKeyService.deleteKey(keyId, applicationId);

      if (!deleted) {
        res.status(404).json({
          error: 'NotFound',
          message: 'API key not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'API key deleted permanently',
      });
    } catch (error: any) {
      console.error('[ApiKeyController.deleteKey]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}

export const apiKeyController = new ApiKeyController();
export default apiKeyController;
