import { apiClient } from './api';
import {
  Application,
  AppStatus,
  CreateApplicationPayload,
  UpdateApplicationPayload,
  ApiKeyInfo,
  GeneratedApiKey,
} from '../types/application';

export const applicationService = {
  // ─── Applications ──────────────────────────────────────────────────────────

  async listApplications(workspaceId: string, status?: AppStatus): Promise<Application[]> {
    const params = status ? { status } : undefined;
    const res = await apiClient.get<{
      success: boolean;
      data: { applications: Application[]; total: number };
    }>(`/workspaces/${workspaceId}/applications`, { params });
    return res.data.data.applications;
  },

  async getApplication(workspaceId: string, applicationId: string): Promise<Application> {
    const res = await apiClient.get<{
      success: boolean;
      data: { application: Application };
    }>(`/workspaces/${workspaceId}/applications/${applicationId}`);
    return res.data.data.application;
  },

  async createApplication(
    workspaceId: string,
    payload: CreateApplicationPayload
  ): Promise<Application> {
    const res = await apiClient.post<{
      success: boolean;
      data: { application: Application };
    }>(`/workspaces/${workspaceId}/applications`, payload);
    return res.data.data.application;
  },

  async updateApplication(
    workspaceId: string,
    applicationId: string,
    payload: UpdateApplicationPayload
  ): Promise<Application> {
    const res = await apiClient.patch<{
      success: boolean;
      data: { application: Application };
    }>(`/workspaces/${workspaceId}/applications/${applicationId}`, payload);
    return res.data.data.application;
  },

  async deleteApplication(workspaceId: string, applicationId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/applications/${applicationId}`);
  },

  // ─── API Keys ──────────────────────────────────────────────────────────────

  async listApiKeys(workspaceId: string, applicationId: string): Promise<ApiKeyInfo[]> {
    const res = await apiClient.get<{
      success: boolean;
      data: { keys: ApiKeyInfo[]; total: number };
    }>(`/workspaces/${workspaceId}/applications/${applicationId}/keys`);
    return res.data.data.keys;
  },

  async generateApiKey(
    workspaceId: string,
    applicationId: string,
    label: string,
    expiresAt?: string
  ): Promise<GeneratedApiKey> {
    const res = await apiClient.post<{
      success: boolean;
      data: { key: GeneratedApiKey };
    }>(`/workspaces/${workspaceId}/applications/${applicationId}/keys`, {
      label,
      ...(expiresAt ? { expiresAt } : {}),
    });
    return res.data.data.key;
  },

  async rotateApiKey(
    workspaceId: string,
    applicationId: string,
    keyId: string,
    label?: string
  ): Promise<GeneratedApiKey> {
    const res = await apiClient.post<{
      success: boolean;
      data: { key: GeneratedApiKey };
    }>(`/workspaces/${workspaceId}/applications/${applicationId}/keys/${keyId}/rotate`, {
      ...(label ? { label } : {}),
    });
    return res.data.data.key;
  },

  async revokeApiKey(
    workspaceId: string,
    applicationId: string,
    keyId: string
  ): Promise<void> {
    await apiClient.post(
      `/workspaces/${workspaceId}/applications/${applicationId}/keys/${keyId}/revoke`
    );
  },

  async deleteApiKey(
    workspaceId: string,
    applicationId: string,
    keyId: string
  ): Promise<void> {
    await apiClient.delete(
      `/workspaces/${workspaceId}/applications/${applicationId}/keys/${keyId}`
    );
  },
};
