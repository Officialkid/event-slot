DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailCampaignType') THEN
		CREATE TYPE "EmailCampaignType" AS ENUM ('REMINDER', 'UPDATE', 'THANK_YOU', 'CUSTOM');
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailCampaignStatus') THEN
		CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');
	END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "EmailCampaign" (
	"id" TEXT NOT NULL,
	"eventId" TEXT NOT NULL,
	"organiserId" TEXT NOT NULL,
	"subject" TEXT NOT NULL,
	"body" TEXT NOT NULL,
	"type" "EmailCampaignType" NOT NULL DEFAULT 'CUSTOM',
	"status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
	"sentAt" TIMESTAMP(3),
	"recipientCount" INTEGER,
	"failureReason" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints
		WHERE constraint_name = 'EmailCampaign_eventId_fkey'
			AND table_name = 'EmailCampaign'
	) THEN
		ALTER TABLE "EmailCampaign"
		ADD CONSTRAINT "EmailCampaign_eventId_fkey"
		FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END
$$;

ALTER TABLE "EmailCampaign"
ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
