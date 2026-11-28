import { apiClient } from './api';
import { AuthResponse } from '../types/auth';

export const authService = {
  /**
   * Verify Google ID token (credential) obtained from Google popup / One Tap
   */
  async verifyGoogleToken(idToken: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/google', { idToken });
    return response.data;
  },

  /**
   * Retrieve currently authenticated user profile & active session
   */
  async getMe(): Promise<AuthResponse> {
    const response = await apiClient.get<AuthResponse>('/auth/me');
    return response.data;
  },

  /**
   * Invalidate server session and clear HTTP-only cookie
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  /**
   * Development mock login (active in non-production)
   */
  async mockLogin(payload: { sub: string; email: string; name: string; picture?: string }): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/mock-login', payload);
    return response.data;
  },
};
