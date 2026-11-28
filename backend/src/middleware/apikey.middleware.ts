import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../modules/apikey/apikey.service.js';

/**
 * API Key Authentication Middleware
 * Validates incoming SDK / telemetry ingestion requests using:
 *   1. `x-api-key: dsk_...` header
 *   2. `Authorization: Bearer dsk_...` header
 *
 * Attaches `req.apiKey` with `{ keyId, applicationId, workspaceId, appId }`.
 * Never logs the raw API key.
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let rawKey: string | undefined;

    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      rawKey = headerKey.trim();
    } else if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        rawKey = parts[1].trim();
      }
    }

    if (!rawKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Provide it via x-api-key header or Bearer token.',
      });
      return;
    }

    const validated = await apiKeyService.validateKey(rawKey);

    if (!validated) {
      res.status(401).json({
        error: 'InvalidApiKey',
        message: 'Invalid, revoked, or expired API key.',
      });
      return;
    }

    req.apiKey = validated;
    next();
  } catch (error) {
    console.error('[requireApiKey Error]: Failed to validate API key');
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to validate API key',
    });
  }
}
