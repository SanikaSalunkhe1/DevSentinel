-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "prefix" VARCHAR(12) NOT NULL,
    "keyHash" VARCHAR(128) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_applicationId_idx" ON "api_keys"("applicationId");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
