import crypto from 'crypto';
import prisma from '../../database/prisma.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const KEY_PREFIX = 'dsk';          // DevSentinel Key
const KEY_BYTES = 32;              // 256-bit random key
const HASH_ALGORITHM = 'sha256';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedKey {
  /** UUID of the api_keys row */
  id: string;
  /** Human-friendly label */
  label: string;
  /** First 8 chars for identification (e.g. "dsk_a1b2") */
  prefix: string;
  /** The FULL raw key — shown ONLY ONCE, never stored or logged */
  rawKey: string;
  /** When the key was created */
  createdAt: Date;
  /** Optional expiry */
  expiresAt: Date | null;
}

export interface ApiKeyInfo {
  id: string;
  label: string;
  prefix: string;
  isActive: boolean;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  applicationId: string;
}

export interface ValidatedKey {
  keyId: string;
  applicationId: string;
  workspaceId: string;
  appId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random API key.
 * Format: dsk_<64 hex chars>  (e.g. "dsk_a1b2c3d4e5f6...")
 */
function generateRawKey(): string {
  const random = crypto.randomBytes(KEY_BYTES).toString('hex');
  return `${KEY_PREFIX}_${random}`;
}

/**
 * Hash a raw key using SHA-256.
 * This is what gets stored in the database — never the raw key.
 */
function hashKey(rawKey: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(rawKey).digest('hex');
}

/**
 * Extract the display prefix from a raw key (first 8 chars after "dsk_").
 */
function extractPrefix(rawKey: string): string {
  // "dsk_a1b2c3d4..." → "dsk_a1b2"
  return rawKey.substring(0, 8);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ApiKeyService {
  /**
   * Generate a new API key for an application.
   * Returns the raw key ONCE — it is never stored or retrievable again.
   */
  async generateKey(
    applicationId: string,
    label: string,
    expiresAt?: Date
  ): Promise<GeneratedKey> {
    // Verify application exists
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!app) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const prefix = extractPrefix(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        applicationId,
        label: label.trim(),
        prefix,
        keyHash,
        expiresAt: expiresAt || null,
      },
    });

    // Return with raw key — this is the ONLY time it's available
    return {
      id: apiKey.id,
      label: apiKey.label,
      prefix: apiKey.prefix,
      rawKey,  // ← shown once, never stored
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
    };
  }

  /**
   * List all API keys for an application (never exposes raw keys or hashes).
   */
  async listKeys(applicationId: string): Promise<ApiKeyInfo[]> {
    const keys = await prisma.apiKey.findMany({
      where: { applicationId },
      select: {
        id: true,
        label: true,
        prefix: true,
        isActive: true,
        revokedAt: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        applicationId: true,
        // keyHash is NEVER selected
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys;
  }

  /**
   * Validate an incoming API key.
   * Hash the raw key and look up the hash in the database.
   * Returns application info if valid, null if invalid/revoked/expired.
   */
  async validateKey(rawKey: string): Promise<ValidatedKey | null> {
    if (!rawKey || !rawKey.startsWith(`${KEY_PREFIX}_`)) {
      return null;
    }

    const keyHash = hashKey(rawKey);

    const apiKey = await prisma.apiKey.findFirst({
      where: { keyHash },
      include: {
        application: {
          select: {
            id: true,
            appId: true,
            workspaceId: true,
            status: true,
          },
        },
      },
    });

    if (!apiKey) return null;

    // Check if key is active
    if (!apiKey.isActive) return null;

    // Check if key is revoked
    if (apiKey.revokedAt) return null;

    // Check if key is expired
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;

    // Check if application is active
    if (apiKey.application.status !== 'ACTIVE') return null;

    // Update lastUsedAt asynchronously (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      keyId: apiKey.id,
      applicationId: apiKey.application.id,
      workspaceId: apiKey.application.workspaceId,
      appId: apiKey.application.appId,
    };
  }

  /**
   * Revoke an API key. The key remains in the database but is marked inactive.
   */
  async revokeKey(keyId: string, applicationId: string): Promise<boolean> {
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, applicationId },
    });

    if (!existing) return false;
    if (!existing.isActive) return false; // already revoked

    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Rotate an API key: revoke the old key and generate a new one.
   * Returns the new raw key (shown once).
   */
  async rotateKey(
    keyId: string,
    applicationId: string,
    newLabel?: string
  ): Promise<GeneratedKey | null> {
    // Find old key
    const oldKey = await prisma.apiKey.findFirst({
      where: { id: keyId, applicationId, isActive: true },
    });

    if (!oldKey) return null;

    // Atomically revoke old + create new in a transaction
    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const prefix = extractPrefix(rawKey);

    const [, newKey] = await prisma.$transaction([
      // Revoke old key
      prisma.apiKey.update({
        where: { id: keyId },
        data: { isActive: false, revokedAt: new Date() },
      }),
      // Create new key
      prisma.apiKey.create({
        data: {
          applicationId,
          label: newLabel?.trim() || oldKey.label,
          prefix,
          keyHash,
          expiresAt: oldKey.expiresAt, // inherit expiry from old key
        },
      }),
    ]);

    return {
      id: newKey.id,
      label: newKey.label,
      prefix: newKey.prefix,
      rawKey,
      createdAt: newKey.createdAt,
      expiresAt: newKey.expiresAt,
    };
  }

  /**
   * Delete an API key permanently (hard delete).
   */
  async deleteKey(keyId: string, applicationId: string): Promise<boolean> {
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, applicationId },
    });

    if (!existing) return false;

    await prisma.apiKey.delete({ where: { id: keyId } });
    return true;
  }
}

export const apiKeyService = new ApiKeyService();
export default apiKeyService;
