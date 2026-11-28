import { Request, Response } from 'express';
import { applicationService } from './application.service.js';
import { AppEnvironment, AppStatus } from '@prisma/client';

// Valid enum values for validation
const VALID_ENVIRONMENTS = Object.values(AppEnvironment);
const VALID_STATUSES = Object.values(AppStatus);

export class ApplicationController {
  /**
   * POST /api/v1/workspaces/:workspaceId/applications
   * Register a new application in the workspace.
   */
  async createApplication(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const { name, description, language, framework, environment } = req.body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Application name is required and must be at least 2 characters',
        });
        return;
      }

      if (name.trim().length > 255) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Application name must not exceed 255 characters',
        });
        return;
      }

      if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid environment. Must be one of: ${VALID_ENVIRONMENTS.join(', ')}`,
        });
        return;
      }

      const application = await applicationService.createApplication(workspaceId, {
        name,
        description,
        language,
        framework,
        environment,
      });

      res.status(201).json({
        success: true,
        message: 'Application registered successfully',
        data: { application },
      });
    } catch (error: any) {
      console.error('[ApplicationController.createApplication]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId/applications
   * List all applications in the workspace.
   * Optional query param: ?status=ACTIVE|INACTIVE|ARCHIVED
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const statusFilter = req.query.status as string | undefined;

      if (statusFilter && !VALID_STATUSES.includes(statusFilter as AppStatus)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
        return;
      }

      const applications = await applicationService.listApplications(
        workspaceId,
        statusFilter as AppStatus | undefined
      );

      res.status(200).json({
        success: true,
        data: {
          applications,
          total: applications.length,
        },
      });
    } catch (error: any) {
      console.error('[ApplicationController.listApplications]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId/applications/:applicationId
   * Get a single application by UUID or human-readable appId.
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);

      // Determine whether this is a UUID or an appId (starts with "app_")
      let application;
      if (applicationId.startsWith('app_')) {
        application = await applicationService.getApplicationByAppId(applicationId, workspaceId);
      } else {
        application = await applicationService.getApplicationById(applicationId, workspaceId);
      }

      if (!application) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Application not found in this workspace',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { application },
      });
    } catch (error: any) {
      console.error('[ApplicationController.getApplication]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * PATCH /api/v1/workspaces/:workspaceId/applications/:applicationId
   * Update application metadata.
   */
  async updateApplication(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);
      const { name, description, language, framework, environment, status } = req.body;

      // Validation
      if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Application name must be at least 2 characters',
        });
        return;
      }

      if (environment !== undefined && !VALID_ENVIRONMENTS.includes(environment)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid environment. Must be one of: ${VALID_ENVIRONMENTS.join(', ')}`,
        });
        return;
      }

      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
        return;
      }

      // Check at least one field is being updated
      if ([name, description, language, framework, environment, status].every((v) => v === undefined)) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Provide at least one field to update',
        });
        return;
      }

      const updated = await applicationService.updateApplication(applicationId, workspaceId, {
        name,
        description,
        language,
        framework,
        environment,
        status,
      });

      if (!updated) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Application not found in this workspace',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application updated successfully',
        data: { application: updated },
      });
    } catch (error: any) {
      console.error('[ApplicationController.updateApplication]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * DELETE /api/v1/workspaces/:workspaceId/applications/:applicationId
   * Delete an application from the workspace.
   */
  async deleteApplication(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const applicationId = String(req.params.applicationId);

      const deleted = await applicationService.deleteApplication(applicationId, workspaceId);

      if (!deleted) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Application not found in this workspace',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application deleted successfully',
      });
    } catch (error: any) {
      console.error('[ApplicationController.deleteApplication]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}

export const applicationController = new ApplicationController();
export default applicationController;
