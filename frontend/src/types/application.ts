export type AppEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type AppStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Application {
  id: string;
  appId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  language: string | null;
  framework: string | null;
  environment: AppEnvironment;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationPayload {
  name: string;
  description?: string;
  language?: string;
  framework?: string;
  environment?: AppEnvironment;
}

export interface UpdateApplicationPayload {
  name?: string;
  description?: string;
  language?: string;
  framework?: string;
  environment?: AppEnvironment;
  status?: AppStatus;
}

export interface ApiKeyInfo {
  id: string;
  label: string;
  prefix: string;
  isActive: boolean;
  revokedAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  applicationId: string;
}

export interface GeneratedApiKey {
  id: string;
  label: string;
  prefix: string;
  rawKey: string;
  createdAt: string;
  expiresAt: string | null;
}

export type ConnectionStatus = 'CONNECTED' | 'AWAITING_TELEMETRY' | 'NO_ACTIVE_KEY';
