import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import {
  verifyGoogleIdToken,
  getGoogleConsentUrl,
  exchangeCodeForGoogleUser,
} from './google.client.js';
import { config } from '../../config/index.js';
import { CookieOptions } from 'express';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: config.env === 'production' ? 'none' : 'lax',
  maxAge: config.session.expiryDays * 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  /**
   * POST /api/v1/auth/google
   * Verifies Google ID token from frontend Google Sign-In popup / One Tap
   */
  async verifyGoogleToken(req: Request, res: Response): Promise<void> {
    try {
      const { idToken, credential } = req.body;
      const token = idToken || credential;

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing Google ID token in request body (idToken or credential)',
        });
        return;
      }

      // Verify with Google
      const payload = await verifyGoogleIdToken(token);

      // Authenticate or register
      const result = await authService.authenticateGoogleUser(payload, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      // Set secure HTTP-only cookie
      res.cookie(config.session.cookieName, result.session.token, cookieOptions);

      res.status(200).json({
        success: true,
        message: result.isNewUser ? 'User registered successfully' : 'Login successful',
        data: {
          user: result.user,
          workspaces: result.workspaces,
          isNewUser: result.isNewUser,
          session: {
            expiresAt: result.session.expiresAt,
            token: result.session.token, // Returned for non-browser / mobile clients
          },
        },
      });
    } catch (error: any) {
      console.error('[AuthController.verifyGoogleToken Error]:', error);
      res.status(401).json({
        error: 'AuthenticationFailed',
        message: error.message || 'Failed to verify Google identity token',
      });
    }
  }

  /**
   * GET /api/v1/auth/google/url
   * Returns Google OAuth 2.0 authorization URL for redirect flow
   */
  getGoogleAuthUrl(req: Request, res: Response): void {
    try {
      const url = getGoogleConsentUrl();
      res.status(200).json({
        success: true,
        url,
      });
    } catch (error: any) {
      console.error('[AuthController.getGoogleAuthUrl Error]:', error);
      res.status(500).json({
        error: 'ConfigurationError',
        message: error.message || 'Failed to generate Google consent URL',
      });
    }
  }

  /**
   * GET /api/v1/auth/google/callback
   * OAuth 2.0 authorization code callback
   */
  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, error } = req.query;

      if (error) {
        res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code || typeof code !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing authorization code in query parameters',
        });
        return;
      }

      // Exchange authorization code for user info
      const payload = await exchangeCodeForGoogleUser(code);

      // Authenticate or register
      const result = await authService.authenticateGoogleUser(payload, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      // Set secure HTTP-only cookie
      res.cookie(config.session.cookieName, result.session.token, cookieOptions);

      // Redirect to frontend dashboard
      res.redirect(`${config.clientUrl}/dashboard?auth=success`);
    } catch (error: any) {
      console.error('[AuthController.handleGoogleCallback Error]:', error);
      res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Returns currently authenticated user profile and workspaces (Protected)
   */
  async getMe(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not logged in' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
        workspaces: user.memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
        })),
        session: {
          id: req.session?.id,
          expiresAt: req.session?.expiresAt,
        },
      },
    });
  }

  /**
   * POST /api/v1/auth/logout
   * Logs out user, invalidates session in database, clears cookie
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.cookies?.[config.session.cookieName] || 
        req.headers.authorization?.replace(/^Bearer /i, '');

      if (token) {
        await authService.revokeSession(token);
      }

      res.clearCookie(config.session.cookieName, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        path: '/',
      });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      console.error('[AuthController.logout Error]:', error);
      res.status(500).json({
        error: 'LogoutFailed',
        message: 'Failed to process logout',
      });
    }
  }

  /**
   * POST /api/v1/auth/mock-login
   * Development & test endpoint for simulating Google Sign-In with verified payload
   */
  async mockLoginForTesting(req: Request, res: Response): Promise<void> {
    if (config.env === 'production') {
      res.status(403).json({ error: 'Forbidden', message: 'Mock login is disabled in production' });
      return;
    }

    try {
      const { sub, email, name, picture } = req.body;

      if (!sub || !email || !name) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing required fields: sub, email, name',
        });
        return;
      }

      const result = await authService.authenticateGoogleUser(
        { sub, email, name, picture },
        {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip || req.socket.remoteAddress,
        }
      );

      res.cookie(config.session.cookieName, result.session.token, cookieOptions);

      res.status(200).json({
        success: true,
        message: result.isNewUser ? 'New user registered' : 'Returning user logged in',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'MockLoginError', message: error.message });
    }
  }
}

export const authController = new AuthController();
export default authController;
