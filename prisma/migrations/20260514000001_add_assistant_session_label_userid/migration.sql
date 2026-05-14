-- Add label and userId to AssistantSession for per-user session history and renaming
ALTER TABLE "AssistantSession" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "AssistantSession" ADD COLUMN IF NOT EXISTS "label" TEXT;

-- Index for fast lookup of sessions by userId
CREATE INDEX IF NOT EXISTS "AssistantSession_userId_idx" ON "AssistantSession"("userId");
