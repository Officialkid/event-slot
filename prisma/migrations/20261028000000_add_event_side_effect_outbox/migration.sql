-- Migration: Add EventCreationSideEffectOutbox and related enums
-- Created for EventSlot Assistant (ESA) Phase 1 durable side-effect outbox

-- 1. Create SideEffectType Enum
DO $$ BEGIN
  CREATE TYPE "SideEffectType" AS ENUM (
    'CALENDAR_SYNC',
    'COMMUNITY_REFERRAL',
    'FOLLOWER_ANNOUNCEMENT',
    'USER_CACHE_PURGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create SideEffectOutboxStatus Enum
DO $$ BEGIN
  CREATE TYPE "SideEffectOutboxStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'AMBIGUOUS_OUTCOME'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create EventCreationSideEffectOutbox Table
CREATE TABLE IF NOT EXISTS "EventCreationSideEffectOutbox" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "creationProposalId" TEXT,
  "organizerId" TEXT NOT NULL,
  "sideEffectType" "SideEffectType" NOT NULL,
  "status" "SideEffectOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingLeaseExpiresAt" TIMESTAMP(3),
  "leaseToken" TEXT,
  "lastError" TEXT,
  "resultMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "attemptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),

  CONSTRAINT "EventCreationSideEffectOutbox_pkey" PRIMARY KEY ("id")
);

-- 4. Unique & Performance Indexes for EventCreationSideEffectOutbox
CREATE UNIQUE INDEX IF NOT EXISTS "EventCreationSideEffectOutbox_idempotencyKey_key" 
  ON "EventCreationSideEffectOutbox"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "EventCreationSideEffectOutbox_status_nextAttemptAt_processingLeaseExpiresAt_idx" 
  ON "EventCreationSideEffectOutbox"("status", "nextAttemptAt", "processingLeaseExpiresAt");

CREATE INDEX IF NOT EXISTS "EventCreationSideEffectOutbox_eventId_sideEffectType_idx" 
  ON "EventCreationSideEffectOutbox"("eventId", "sideEffectType");

CREATE INDEX IF NOT EXISTS "EventCreationSideEffectOutbox_creationProposalId_idx" 
  ON "EventCreationSideEffectOutbox"("creationProposalId");

CREATE INDEX IF NOT EXISTS "EventCreationSideEffectOutbox_organizerId_status_idx" 
  ON "EventCreationSideEffectOutbox"("organizerId", "status");

-- 5. Foreign Keys for EventCreationSideEffectOutbox
DO $$ BEGIN
  ALTER TABLE "EventCreationSideEffectOutbox"
    ADD CONSTRAINT "EventCreationSideEffectOutbox_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventCreationSideEffectOutbox"
    ADD CONSTRAINT "EventCreationSideEffectOutbox_creationProposalId_fkey"
    FOREIGN KEY ("creationProposalId") REFERENCES "AssistantActionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventCreationSideEffectOutbox"
    ADD CONSTRAINT "EventCreationSideEffectOutbox_organizerId_fkey"
    FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
