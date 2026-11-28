import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Workspace } from '../types/auth';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithMock: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveWorkspace: (workspace: Workspace) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize session on page mount
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const response = await authService.getMe();
        if (mounted && response.success && response.data) {
          setUser(response.data.user);
          setWorkspaces(response.data.workspaces || []);
          if (response.data.workspaces && response.data.workspaces.length > 0) {
            setActiveWorkspace(response.data.workspaces[0]);
          }
        }
      } catch {
        // Unauthenticated - expected when no cookie is present
        if (mounted) {
          setUser(null);
          setWorkspaces([]);
          setActiveWorkspace(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.verifyGoogleToken(idToken);
      if (response.success && response.data) {
        setUser(response.data.user);
        setWorkspaces(response.data.workspaces || []);
        if (response.data.workspaces && response.data.workspaces.length > 0) {
          setActiveWorkspace(response.data.workspaces[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithMock = async (email: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const sub = `dev-${Date.now()}`;
      const response = await authService.mockLogin({
        sub,
        email,
        name,
        picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      });
      if (response.success && response.data) {
        setUser(response.data.user);
        setWorkspaces(response.data.workspaces || []);
        if (response.data.workspaces && response.data.workspaces.length > 0) {
          setActiveWorkspace(response.data.workspaces[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Development login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        isLoading,
        error,
        isAuthenticated: !!user,
        loginWithGoogle,
        loginWithMock,
        logout,
        setActiveWorkspace,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
