-- CreateEnum
CREATE TYPE "AppEnvironment" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "appId" VARCHAR(32) NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "language" VARCHAR(50),
    "framework" VARCHAR(50),
    "environment" "AppEnvironment" NOT NULL DEFAULT 'DEVELOPMENT',
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_appId_key" ON "applications"("appId");

-- CreateIndex
CREATE INDEX "applications_workspaceId_idx" ON "applications"("workspaceId");

-- CreateIndex
CREATE INDEX "applications_appId_idx" ON "applications"("appId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
