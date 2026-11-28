const REDACTED = '[REDACTED]';

const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'apikey',
  'api_key',
  'x-api-key',
  'authorization',
  'auth',
  'cookie',
  'set-cookie',
  'jwt',
  'bearer',
  'ssn',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'privatekey',
  'private_key',
]);

/**
 * Redacts sensitive patterns inside strings (Bearer tokens, dsk_ API keys, URL query params).
 */
export function redactString(input: string): string {
  return input
    // Redact DevSentinel API keys (dsk_<hex>)
    .replace(/\bdsk_[a-fA-F0-9]{16,}\b/g, REDACTED)
    // Redact Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${REDACTED}`)
    // Redact sensitive query parameters in URLs
    .replace(
      /([?&](?:api_?key|token|access_token|secret|password|auth)=)[^&\s]*/gi,
      `$1${REDACTED}`
    );
}

/**
 * Recursively redacts sensitive keys and string patterns in objects/arrays.
 * Handles circular references safely without throwing.
 */
export function redactValue(
  value: unknown,
  extraKeys: string[] = [],
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, extraKeys, seen));
  }

  const normalizedExtra = new Set(extraKeys.map((k) => k.toLowerCase()));
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (DEFAULT_SENSITIVE_KEYS.has(lowerKey) || normalizedExtra.has(lowerKey)) {
      result[key] = REDACTED;
    } else {
      result[key] = redactValue(val, extraKeys, seen);
    }
  }

  return result;
}
