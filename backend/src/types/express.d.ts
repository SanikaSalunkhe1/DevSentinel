import { User, Session, Workspace, WorkspaceRole } from '@prisma/client';
import { ValidatedKey } from '../modules/apikey/apikey.service.js';

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
      workspaceRole?: WorkspaceRole;
      apiKey?: ValidatedKey;
    }
  }
}
