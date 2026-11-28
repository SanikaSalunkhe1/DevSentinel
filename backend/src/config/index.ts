import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory or root
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/google/callback',
  },
  session: {
    cookieName: 'ds_session',
    expiryDays: 7,
    jwtSecret: process.env.JWT_SECRET || 'devsentinel-default-secret-key-32chars',
  },
};
