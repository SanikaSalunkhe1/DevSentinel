import { Request, Response } from 'express';
import { workspaceService } from './workspace.service.js';
import { WorkspaceRole } from '@prisma/client';

export class WorkspaceController {
  /**
   * GET /api/v1/workspaces
   * Returns all workspaces the authenticated user is a member of.
   */
  async listWorkspaces(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaces = await workspaceService.listUserWorkspaces(userId);

      res.status(200).json({
        success: true,
        data: { workspaces },
      });
    } catch (error: any) {
      console.error('[WorkspaceController.listWorkspaces]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId
   * Returns a single workspace with its full member list.
   * Caller must be a member of the workspace.
   */
  async getWorkspace(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const userId = req.user!.id;

      const workspace = await workspaceService.getWorkspaceById(workspaceId, userId);

      if (!workspace) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Workspace not found or you are not a member',
        });
        return;
      }

      res.status(200).json({ success: true, data: { workspace } });
    } catch (error: any) {
      console.error('[WorkspaceController.getWorkspace]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/slug/:slug
   * Looks up a workspace by its URL slug.
   * Caller must be a member.
   */
  async getWorkspaceBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = String(req.params.slug);
      const userId = req.user!.id;

      const workspace = await workspaceService.getWorkspaceBySlug(slug, userId);

      if (!workspace) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Workspace not found or you are not a member',
        });
        return;
      }

      res.status(200).json({ success: true, data: { workspace } });
    } catch (error: any) {
      console.error('[WorkspaceController.getWorkspaceBySlug]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * PATCH /api/v1/workspaces/:workspaceId
   * Updates workspace name and/or slug.
   * Requires OWNER or ADMIN role.
   */
  async updateWorkspace(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const userId = req.user!.id;
      const { name, slug } = req.body;

      // Basic input validation
      if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Workspace name must be at least 2 characters',
        });
        return;
      }

      if (slug !== undefined) {
        const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (typeof slug !== 'string' || !slugPattern.test(slug) || slug.length > 100) {
          res.status(400).json({
            error: 'ValidationError',
            message: 'Slug must be lowercase alphanumeric with hyphens only (e.g. my-workspace)',
          });
          return;
        }
      }

      if (name === undefined && slug === undefined) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Provide at least one field to update: name or slug',
        });
        return;
      }

      const result = await workspaceService.updateWorkspace(workspaceId, userId, {
        name: name?.trim(),
        slug,
      });

      if (!result.success) {
        const statusMap: Record<string, number> = {
          NOT_MEMBER: 403,
          INSUFFICIENT_ROLE: 403,
          SLUG_TAKEN: 409,
        };
        const messageMap: Record<string, string> = {
          NOT_MEMBER: 'You are not a member of this workspace',
          INSUFFICIENT_ROLE: 'Only workspace OWNER or ADMIN can update workspace settings',
          SLUG_TAKEN: 'This slug is already in use by another workspace',
        };
        res.status(statusMap[result.error] || 400).json({
          error: result.error,
          message: messageMap[result.error] || 'Update failed',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Workspace updated successfully',
        data: { workspace: result.workspace },
      });
    } catch (error: any) {
      console.error('[WorkspaceController.updateWorkspace]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId/members
   * Returns the member list for a workspace.
   * Caller must be a member.
   */
  async listMembers(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const userId = req.user!.id;

      const workspace = await workspaceService.getWorkspaceById(workspaceId, userId);

      if (!workspace) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Workspace not found or you are not a member',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          members: workspace.members,
          total: workspace.members.length,
        },
      });
    } catch (error: any) {
      console.error('[WorkspaceController.listMembers]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/v1/workspaces/:workspaceId/my-role
   * Returns the current user's role in this workspace.
   */
  async getMyRole(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = String(req.params.workspaceId);
      const userId = req.user!.id;

      const role = await workspaceService.getMemberRole(workspaceId, userId);

      if (!role) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not a member of this workspace',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { role },
      });
    } catch (error: any) {
      console.error('[WorkspaceController.getMyRole]:', error);
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}

export const workspaceController = new WorkspaceController();
export default workspaceController;
