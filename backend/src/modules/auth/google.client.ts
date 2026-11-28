import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/index.js';

export interface GooglePayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
}

// Singleton OAuth2Client
export const googleOAuthClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

/**
 * Verify Google ID Token (OIDC identity token)
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GooglePayload> {
  if (!config.google.clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in backend environment');
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google ID token payload');
  }

  if (!payload.email) {
    throw new Error('Google token does not contain an email address');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
    emailVerified: payload.email_verified,
  };
}

/**
 * Generate Google OAuth 2.0 consent URL for redirect flow
 */
export function getGoogleConsentUrl(): string {
  return googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });
}

/**
 * Exchange Authorization Code for Tokens and verify identity
 */
export async function exchangeCodeForGoogleUser(code: string): Promise<GooglePayload> {
  const { tokens } = await googleOAuthClient.getToken(code);
  googleOAuthClient.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('Google OAuth did not return an id_token');
  }

  return verifyGoogleIdToken(tokens.id_token);
}
