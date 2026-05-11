-- Drop old string-based tables if they exist (from manual bootstrap)
DROP TABLE IF EXISTS "AssistantMessage";
DROP TABLE IF EXISTS "AssistantSession";

-- Enums
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

-- AssistantSession
CREATE TABLE "AssistantSession" (
  "id"            TEXT NOT NULL,
  "ipHash"        TEXT NOT NULL,
  "userAgent"     TEXT,
  "channel"       "SessionChannel" NOT NULL DEFAULT 'TEXT',
  "status"        "SessionStatus"  NOT NULL DEFAULT 'ACTIVE',
  "flagged"       BOOLEAN          NOT NULL DEFAULT false,
  "flagReason"    TEXT,
  "messageCount"  INTEGER          NOT NULL DEFAULT 0,
  "offTopicCount" INTEGER          NOT NULL DEFAULT 0,
  "startedAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"       TIMESTAMP(3),
  CONSTRAINT "AssistantSession_pkey" PRIMARY KEY ("id")
);

-- AssistantMessage
CREATE TABLE "AssistantMessage" (
  "id"        TEXT          NOT NULL,
  "sessionId" TEXT          NOT NULL,
  "role"      "MessageRole" NOT NULL,
  "content"   TEXT          NOT NULL,
  "isVoice"   BOOLEAN       NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantMessage_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AssistantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
