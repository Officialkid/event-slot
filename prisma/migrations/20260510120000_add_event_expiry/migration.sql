-- Add expiresAt column for 30-day auto-delete feature (Free tier only)
ALTER TABLE "Event" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Create index for efficient cron job filtering
CREATE INDEX "idx_event_expires_at" ON "Event"("expiresAt") WHERE "status" = 'COMPLETED' AND "expiresAt" IS NOT NULL;
