# DevSentinel API Key Configuration & Security

API keys authenticate external applications and SDKs sending telemetry, logs, and errors to DevSentinel.

## Key Format & Storage

- **Format**: `dsk_<64_hex_characters>` (256-bit cryptographically random value generated via `crypto.randomBytes(32)`).
- **Prefix**: First 8 characters (e.g., `dsk_a1b2`) are stored for display and identification in the UI/API.
- **One-time display**: The complete `rawKey` is returned **only once** at creation (`POST .../keys`) or rotation (`POST .../keys/:keyId/rotate`).
- **Hashing**: Only the **SHA-256** digest (`keyHash`) is stored in PostgreSQL (`api_keys` table). Raw keys are never persisted or logged.

## Management Endpoints

All management endpoints require session authentication (`requireAuth`) and workspace membership (`requireWorkspaceMember`).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/workspaces/:workspaceId/applications/:applicationId/keys` | Generate a new API key (body: `{ label, expiresAt? }`). Returns `rawKey` once. |
| `GET` | `/api/v1/workspaces/:workspaceId/applications/:applicationId/keys` | List keys for an application (returns `prefix`, `label`, `isActive`, timestamps — never `rawKey` or `keyHash`). |
| `POST` | `/api/v1/workspaces/:workspaceId/applications/:applicationId/keys/:keyId/revoke` | Revoke a key (`isActive = false`, sets `revokedAt`). |
| `POST` | `/api/v1/workspaces/:workspaceId/applications/:applicationId/keys/:keyId/rotate` | Atomically revokes the old key and creates a new key (returns new `rawKey` once). |
| `DELETE` | `/api/v1/workspaces/:workspaceId/applications/:applicationId/keys/:keyId` | Permanently delete a key record. |

## Authenticating Requests with an API Key

### Option 1: `x-api-key` Header (Recommended for SDKs)
```http
x-api-key: dsk_your_api_key_here
```

### Option 2: `Authorization: Bearer` Header
```http
Authorization: Bearer dsk_your_api_key_here
```

### Validation Endpoint
```http
POST /api/v1/auth/validate-key
Content-Type: application/json

{
  "apiKey": "dsk_your_api_key_here"
}
```
Returns `200 OK` with `{ applicationId, workspaceId, appId }` if valid, or `401 Unauthorized` if invalid, revoked, expired, or belonging to an inactive application.

## Backend Middleware Usage

Use `requireApiKey` from `backend/src/middleware/apikey.middleware.ts` to protect ingestion routes:

```ts
import { requireApiKey } from '../../middleware/apikey.middleware.js';

router.post('/ingest', requireApiKey, (req, res) => {
  // req.apiKey contains { keyId, applicationId, workspaceId, appId }
});
```
