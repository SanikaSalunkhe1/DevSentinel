export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface SessionInfo {
  id?: string;
  token?: string;
  expiresAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    workspaces: Workspace[];
    isNewUser?: boolean;
    session: SessionInfo;
  };
}
