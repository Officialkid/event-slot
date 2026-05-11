-- Token Economy Migration
-- Add TransactionType enum
DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'DEBIT', 'REFUND', 'ADMIN_GRANT', 'BONUS', 'MONTHLY_VOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TokenBalance table
CREATE TABLE IF NOT EXISTS "TokenBalance" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "balance"   INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id")
);

-- TokenTransaction table
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

-- VoiceQuota table
CREATE TABLE IF NOT EXISTS "VoiceQuota" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "usedThisMonth" INTEGER NOT NULL DEFAULT 0,
  "resetAt"       TIMESTAMP(3) NOT NULL,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceQuota_pkey" PRIMARY KEY ("id")
);

-- RateLimitLog table
CREATE TABLE IF NOT EXISTS "RateLimitLog" (
  "id"        TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitLog_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TokenBalance_userId_key" ON "TokenBalance"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "VoiceQuota_userId_key"   ON "VoiceQuota"("userId");

-- RateLimitLog index
CREATE INDEX IF NOT EXISTS "RateLimitLog_key_createdAt_idx" ON "RateLimitLog"("key", "createdAt");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "TokenBalance" ADD CONSTRAINT "TokenBalance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TokenTransaction" ADD CONSTRAINT "TokenTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoiceQuota" ADD CONSTRAINT "VoiceQuota_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
