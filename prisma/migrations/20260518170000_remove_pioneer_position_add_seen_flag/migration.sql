-- Remove per-user pioneer ranking and track first-login congratulations state.
ALTER TABLE "PioneerBadge"
  DROP COLUMN "position",
  ADD COLUMN "hasSeenCongratulations" BOOLEAN NOT NULL DEFAULT false;
