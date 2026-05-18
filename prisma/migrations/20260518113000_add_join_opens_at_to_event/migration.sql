-- Add customizable attendee join window start time for virtual events.
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "joinOpensAt" TIMESTAMP(3);
