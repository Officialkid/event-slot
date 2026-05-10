-- Feature 4: Platform notification broadcasts (in-app)
-- NOTE: This migration was prepared manually because prisma migrate dev could not reach the database at execution time.

DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('EVENT', 'PLATFORM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "link" TEXT;

UPDATE "Notification"
SET "title" = CASE
  WHEN "type" = 'waitlist_growing' THEN 'Waitlist Growing'
  WHEN "type" = 'feedback_request' THEN 'Feedback Request'
  WHEN "type" = 'data_expiry_warning' THEN 'Data Expiry Warning'
  WHEN "type" = 'payment_failed' THEN 'Payment Failed'
  WHEN "type" = 'registration' THEN 'New Registration'
  WHEN "type" = 'full' THEN 'Event Full'
  ELSE 'Event Update'
END
WHERE "title" IS NULL;

ALTER TABLE "Notification"
ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "Notification"
ALTER COLUMN "type" TYPE "NotificationType"
USING 'EVENT'::"NotificationType";

ALTER TABLE "Notification"
DROP COLUMN IF EXISTS "eventId";
