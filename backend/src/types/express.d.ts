import { User, Session, Workspace, WorkspaceRole } from '@prisma/client';

export interface AuthenticatedUser extends User {
  memberships: {
    id: string;
    role: WorkspaceRole;
    workspace: Workspace;
  }[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: Session;
    }
  }
}
