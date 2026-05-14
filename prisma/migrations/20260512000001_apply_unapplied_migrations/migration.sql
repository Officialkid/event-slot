-- Idempotent migration to apply changes from loose SQL files:
-- add_token_economy.sql and manual_assistant_sessions.sql
-- These were previously applied manually and never tracked by Prisma.

-- ============================================================
-- 1. Create enums idempotently
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('USER_FEEDBACK', 'ADMIN_BROADCAST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'DEBIT', 'REFUND', 'ADMIN_GRANT', 'BONUS', 'MONTHLY_VOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SessionChannel" AS ENUM ('TEXT', 'VOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'FLAGGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Drop old audit log indexes if they exist
-- ============================================================

DROP INDEX IF EXISTS "idx_audit_log_action";
DROP INDEX IF EXISTS "idx_audit_log_actor_id";
DROP INDEX IF EXISTS "idx_audit_log_created_at";

-- ============================================================
-- 3. Alter Message table: drop old columns, add new columns
-- ============================================================

ALTER TABLE "Message" DROP COLUMN IF EXISTS "archived";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "body";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "eventId";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "eventTitle";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "rating";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "read";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "senderEmail";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "senderName";

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "content" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "subject" TEXT NOT NULL DEFAULT '';

-- Convert type column from TEXT to MessageType enum if not already done
DO $$
BEGIN
  -- Check if type column is still TEXT type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Message' AND column_name = 'type'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "Message" DROP COLUMN "type";
    ALTER TABLE "Message" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'ADMIN_BROADCAST';
  END IF;

  -- If type column doesn't exist at all, add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Message' AND column_name = 'type'
  ) THEN
    ALTER TABLE "Message" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'ADMIN_BROADCAST';
  END IF;
END $$;

-- Add foreign key for Message.authorId if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Message_authorId_fkey'
      AND table_name = 'Message'
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "Message_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. Create TokenBalance table
-- ============================================================

CREATE TABLE IF NOT EXISTS "TokenBalance" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "balance"   INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TokenBalance_userId_key" ON "TokenBalance"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TokenBalance_userId_fkey'
      AND table_name = 'TokenBalance'
  ) THEN
    ALTER TABLE "TokenBalance"
      ADD CONSTRAINT "TokenBalance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. Create TokenTransaction table
-- ============================================================

CREATE TABLE IF NOT EXISTS "TokenTransaction" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "type"          "TransactionType" NOT NULL,
    "amount"        INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter"  INTEGER NOT NULL,
    "description"   TEXT NOT NULL,
    "referenceId"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenTransaction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TokenTransaction_userId_fkey'
      AND table_name = 'TokenTransaction'
  ) THEN
    ALTER TABLE "TokenTransaction"
      ADD CONSTRAINT "TokenTransaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. Create VoiceQuota table
-- ============================================================

CREATE TABLE IF NOT EXISTS "VoiceQuota" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "usedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "resetAt"       TIMESTAMP(3) NOT NULL,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoiceQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceQuota_userId_key" ON "VoiceQuota"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VoiceQuota_userId_fkey'
      AND table_name = 'VoiceQuota'
  ) THEN
    ALTER TABLE "VoiceQuota"
      ADD CONSTRAINT "VoiceQuota_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 7. Create RateLimitLog table
-- ============================================================

CREATE TABLE IF NOT EXISTS "RateLimitLog" (
    "id"        TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateLimitLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RateLimitLog_key_createdAt_idx" ON "RateLimitLog"("key", "createdAt");

-- ============================================================
-- 8. Create AssistantSession table
-- ============================================================

CREATE TABLE IF NOT EXISTS "AssistantSession" (
    "id"            TEXT NOT NULL,
    "ipHash"        TEXT NOT NULL,
    "userAgent"     TEXT,
    "channel"       "SessionChannel" NOT NULL DEFAULT 'TEXT',
    "status"        "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "flagged"       BOOLEAN NOT NULL DEFAULT false,
    "flagReason"    TEXT,
    "messageCount"  INTEGER NOT NULL DEFAULT 0,
    "offTopicCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"       TIMESTAMP(3),
    CONSTRAINT "AssistantSession_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 9. Create AssistantMessage table
-- ============================================================

CREATE TABLE IF NOT EXISTS "AssistantMessage" (
    "id"        TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role"      "MessageRole" NOT NULL,
    "content"   TEXT NOT NULL,
    "isVoice"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AssistantMessage_sessionId_fkey'
      AND table_name = 'AssistantMessage'
  ) THEN
    ALTER TABLE "AssistantMessage"
      ADD CONSTRAINT "AssistantMessage_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "AssistantSession"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
