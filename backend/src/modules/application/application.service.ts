import crypto from 'crypto';
import prisma from '../../database/prisma.js';
import { AppEnvironment, AppStatus } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateApplicationInput {
  name: string;
  description?: string;
  language?: string;
  framework?: string;
  environment?: AppEnvironment;
}

export interface UpdateApplicationInput {
  name?: string;
  description?: string;
  language?: string;
  framework?: string;
  environment?: AppEnvironment;
  status?: AppStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a unique, human-readable application ID.
 * Format: app_<8 random hex chars>  (e.g. "app_a1b2c3d4")
 */
function generateAppId(): string {
  return `app_${crypto.randomBytes(4).toString('hex')}`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ApplicationService {
  /**
   * Register a new application in a workspace.
   */
  async createApplication(workspaceId: string, input: CreateApplicationInput) {
    // Generate a unique appId — retry if collision (extremely unlikely)
    let appId = generateAppId();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.application.findUnique({ where: { appId } });
      if (!existing) break;
      appId = generateAppId();
      attempts++;
    }

    const application = await prisma.application.create({
      data: {
        appId,
        workspaceId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        language: input.language?.trim() || null,
        framework: input.framework?.trim() || null,
        environment: input.environment ?? AppEnvironment.DEVELOPMENT,
      },
    });

    return application;
  }

  /**
   * List all applications in a workspace.
   * Supports optional status filter.
   */
  async listApplications(workspaceId: string, statusFilter?: AppStatus) {
    const applications = await prisma.application.findMany({
      where: {
        workspaceId,
        ...(statusFilter && { status: statusFilter }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }

  /**
   * Get a single application by its UUID, scoped to a workspace.
   */
  async getApplicationById(applicationId: string, workspaceId: string) {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        workspaceId,
      },
    });

    return application;
  }

  /**
   * Get a single application by its human-readable appId, scoped to a workspace.
   */
  async getApplicationByAppId(appId: string, workspaceId: string) {
    const application = await prisma.application.findFirst({
      where: {
        appId,
        workspaceId,
      },
    });

    return application;
  }

  /**
   * Update application metadata.
   */
  async updateApplication(applicationId: string, workspaceId: string, input: UpdateApplicationInput) {
    // Verify application belongs to workspace
    const existing = await prisma.application.findFirst({
      where: { id: applicationId, workspaceId },
    });

    if (!existing) return null;

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() || null }),
        ...(input.language !== undefined && { language: input.language?.trim() || null }),
        ...(input.framework !== undefined && { framework: input.framework?.trim() || null }),
        ...(input.environment !== undefined && { environment: input.environment }),
        ...(input.status !== undefined && { status: input.status }),
      },
    });

    return updated;
  }

  /**
   * Delete an application (hard delete). Scoped to workspace.
   */
  async deleteApplication(applicationId: string, workspaceId: string): Promise<boolean> {
    const existing = await prisma.application.findFirst({
      where: { id: applicationId, workspaceId },
    });

    if (!existing) return false;

    await prisma.application.delete({ where: { id: applicationId } });
    return true;
  }

  /**
   * Count applications in a workspace, optionally by status.
   */
  async countApplications(workspaceId: string, statusFilter?: AppStatus): Promise<number> {
    return prisma.application.count({
      where: {
        workspaceId,
        ...(statusFilter && { status: statusFilter }),
      },
    });
  }
}

export const applicationService = new ApplicationService();
export default applicationService;
