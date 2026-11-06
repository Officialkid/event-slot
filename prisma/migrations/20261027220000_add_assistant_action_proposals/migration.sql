-- Migration: Add AssistantActionProposal and Event.creationProposalId
-- Created for EventSlot Assistant (ESA) Phase 1 durable action proposals

-- 1. Create ActionProposalStatus Enum
DO $$ BEGIN
  CREATE TYPE "ActionProposalStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'EXECUTING',
    'COMPLETED',
    'FAILED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create AssistantActionProposal Table
CREATE TABLE IF NOT EXISTS "AssistantActionProposal" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "status" "ActionProposalStatus" NOT NULL DEFAULT 'PENDING',
  "actorId" TEXT NOT NULL,
  "sessionId" TEXT,
  "workspaceOrganizerId" TEXT,
  "targetEventId" TEXT,
  "draftId" TEXT NOT NULL,
  "draftVersion" TEXT NOT NULL,
  "validatedInput" JSONB NOT NULL,
  "previewCard" JSONB NOT NULL,
  "resultMetadata" JSONB,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "executionStartedAt" TIMESTAMP(3),
  "executionLeaseExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),

  CONSTRAINT "AssistantActionProposal_pkey" PRIMARY KEY ("id")
);

-- 3. Unique & Performance Indexes for AssistantActionProposal
CREATE UNIQUE INDEX IF NOT EXISTS "AssistantActionProposal_idempotencyKey_key" 
  ON "AssistantActionProposal"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "AssistantActionProposal_actorId_status_idx" 
  ON "AssistantActionProposal"("actorId", "status");

CREATE INDEX IF NOT EXISTS "AssistantActionProposal_sessionId_status_idx" 
  ON "AssistantActionProposal"("sessionId", "status");

CREATE INDEX IF NOT EXISTS "AssistantActionProposal_draftId_draftVersion_idx" 
  ON "AssistantActionProposal"("draftId", "draftVersion");

CREATE INDEX IF NOT EXISTS "AssistantActionProposal_status_executionLeaseExpiresAt_idx" 
  ON "AssistantActionProposal"("status", "executionLeaseExpiresAt");

CREATE INDEX IF NOT EXISTS "AssistantActionProposal_expiresAt_idx" 
  ON "AssistantActionProposal"("expiresAt");

-- 4. Foreign Keys for AssistantActionProposal
DO $$ BEGIN
  ALTER TABLE "AssistantActionProposal"
    ADD CONSTRAINT "AssistantActionProposal_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AssistantActionProposal"
    ADD CONSTRAINT "AssistantActionProposal_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Add correlation column to Event table
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "creationProposalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Event_creationProposalId_key" 
  ON "Event"("creationProposalId");

DO $$ BEGIN
  ALTER TABLE "Event"
    ADD CONSTRAINT "Event_creationProposalId_fkey"
    FOREIGN KEY ("creationProposalId") REFERENCES "AssistantActionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
