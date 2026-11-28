import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service.js';
import { config } from '../config/index.js';

/**
 * Authentication Middleware: Protects routes and verifies session validity.
 * Reads token from:
 * 1. HTTP-only cookie (`ds_session`)
 * 2. Authorization header (`Bearer <token>`)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Extract session token
    let token = req.cookies?.[config.session.cookieName];

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. No session cookie or Bearer token provided.',
      });
      return;
    }

    // 2. Verify session in database
    const session = await authService.getSessionByToken(token);

    if (!session || !session.user) {
      // Clear invalid cookie
      res.clearCookie(config.session.cookieName, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session. Please sign in again.',
      });
      return;
    }

    // 3. Attach authenticated user and session to request context
    req.user = session.user as any;
    req.session = session;

    next();
  } catch (error: any) {
    console.error('[Auth Middleware Error]:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to authenticate request',
    });
  }
}
