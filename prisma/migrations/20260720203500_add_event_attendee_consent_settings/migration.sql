ALTER TABLE "Event"
ADD COLUMN "attendeeConsentEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "attendeeConsentText" TEXT;
