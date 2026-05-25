DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PeriodType') THEN
		CREATE TYPE "PeriodType" AS ENUM ('WEEK', 'MONTH', 'ALL_TIME');
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON e.enumtypid = t.oid
		WHERE t.typname = 'BadgeType' AND e.enumlabel = 'STARRED_ORGANIZER'
	) THEN
		ALTER TYPE "BadgeType" ADD VALUE 'STARRED_ORGANIZER';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON e.enumtypid = t.oid
		WHERE t.typname = 'BadgeType' AND e.enumlabel = 'COMMUNITY_BUILDER'
	) THEN
		ALTER TYPE "BadgeType" ADD VALUE 'COMMUNITY_BUILDER';
	END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "EventFAQ" (
	"id" TEXT NOT NULL,
	"eventId" TEXT NOT NULL,
	"question" TEXT NOT NULL,
	"answer" TEXT NOT NULL,
	"order" INTEGER NOT NULL DEFAULT 0,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	CONSTRAINT "EventFAQ_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Ticket" (
	"id" TEXT NOT NULL,
	"code" TEXT NOT NULL,
	"registrationId" TEXT NOT NULL,
	"generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"scannedAt" TIMESTAMP(3),
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantFeedback" (
	"id" TEXT NOT NULL,
	"identifier" TEXT NOT NULL,
	"rating" INTEGER NOT NULL,
	"comment" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatQuota" (
	"id" TEXT NOT NULL,
	"identifier" TEXT NOT NULL,
	"creditsUsed" INTEGER NOT NULL DEFAULT 0,
	"windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	CONSTRAINT "ChatQuota_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExchangeRate" (
	"id" TEXT NOT NULL,
	"currency" TEXT NOT NULL,
	"rate" DOUBLE PRECISION NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CountrySnapshot" (
	"id" TEXT NOT NULL,
	"countryCode" TEXT NOT NULL,
	"countryName" TEXT NOT NULL,
	"userCount" INTEGER NOT NULL,
	"organizerCount" INTEGER NOT NULL,
	"eventCount" INTEGER NOT NULL,
	"snapshotDate" DATE NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "CountrySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WeeklyRankingNotification" (
	"id" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"weekKey" TEXT NOT NULL,
	"rank" INTEGER NOT NULL,
	"totalPts" INTEGER NOT NULL,
	"seen" BOOLEAN NOT NULL DEFAULT false,
	"sharedAt" TIMESTAMP(3),
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "WeeklyRankingNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssistantSession"
	ADD COLUMN IF NOT EXISTS "imageCount" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "AssistantSession_userId_idx";

ALTER TABLE "Event"
	ADD COLUMN IF NOT EXISTS "aiInsightsFreeUsed" BOOLEAN NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS "category" TEXT,
	ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
	ADD COLUMN IF NOT EXISTS "faqEnabled" BOOLEAN NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;

ALTER TABLE "Event"
	ALTER COLUMN "ticketsEnabled" SET DEFAULT true;

ALTER TABLE "Registration"
	ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

ALTER TABLE "User"
	ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
	ADD COLUMN IF NOT EXISTS "countryName" TEXT,
	ADD COLUMN IF NOT EXISTS "signupCountry" TEXT;

ALTER TABLE "LeaderboardEntry"
	ADD COLUMN IF NOT EXISTS "period" TEXT,
	ADD COLUMN IF NOT EXISTS "periodType" "PeriodType",
	ADD COLUMN IF NOT EXISTS "referralPts" INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS "organiserPts" INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS "totalPts" INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS "referralRank" INTEGER,
	ADD COLUMN IF NOT EXISTS "organiserRank" INTEGER,
	ADD COLUMN IF NOT EXISTS "overallRank" INTEGER,
	ADD COLUMN IF NOT EXISTS "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LeaderboardEntry"
SET
	"period" = COALESCE("period", 'all-time'),
	"periodType" = COALESCE("periodType", 'ALL_TIME'::"PeriodType")
WHERE "period" IS NULL OR "periodType" IS NULL;

ALTER TABLE "LeaderboardEntry"
	ALTER COLUMN "period" SET NOT NULL,
	ALTER COLUMN "periodType" SET NOT NULL;

ALTER TABLE "LeaderboardEntry"
	DROP COLUMN IF EXISTS "allTimeRank",
	DROP COLUMN IF EXISTS "allTimeScore",
	DROP COLUMN IF EXISTS "monthlyRank",
	DROP COLUMN IF EXISTS "monthlyScore",
	DROP COLUMN IF EXISTS "updatedAt",
	DROP COLUMN IF EXISTS "weekStart",
	DROP COLUMN IF EXISTS "weeklyRank",
	DROP COLUMN IF EXISTS "weeklyScore";

ALTER TABLE "Message"
	ALTER COLUMN "content" DROP DEFAULT,
	ALTER COLUMN "subject" DROP DEFAULT,
	ALTER COLUMN "type" DROP DEFAULT;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints
		WHERE constraint_name = 'EventFAQ_eventId_fkey'
			AND table_name = 'EventFAQ'
	) THEN
		ALTER TABLE "EventFAQ"
			ADD CONSTRAINT "EventFAQ_eventId_fkey"
			FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints
		WHERE constraint_name = 'Ticket_registrationId_fkey'
			AND table_name = 'Ticket'
	) THEN
		ALTER TABLE "Ticket"
			ADD CONSTRAINT "Ticket_registrationId_fkey"
			FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints
		WHERE constraint_name = 'WeeklyRankingNotification_userId_fkey'
			AND table_name = 'WeeklyRankingNotification'
	) THEN
		ALTER TABLE "WeeklyRankingNotification"
			ADD CONSTRAINT "WeeklyRankingNotification_userId_fkey"
			FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "AssistantFeedback_identifier_createdAt_idx"
	ON "AssistantFeedback"("identifier", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ChatQuota_identifier_key"
	ON "ChatQuota"("identifier");

CREATE UNIQUE INDEX IF NOT EXISTS "CountrySnapshot_countryCode_snapshotDate_key"
	ON "CountrySnapshot"("countryCode", "snapshotDate");

CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_currency_key"
	ON "ExchangeRate"("currency");

CREATE UNIQUE INDEX IF NOT EXISTS "LeaderboardEntry_userId_period_key"
	ON "LeaderboardEntry"("userId", "period");

CREATE INDEX IF NOT EXISTS "LeaderboardEntry_period_totalPts_idx"
	ON "LeaderboardEntry"("period", "totalPts");

CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_code_key"
	ON "Ticket"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_registrationId_key"
	ON "Ticket"("registrationId");

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyRankingNotification_userId_weekKey_key"
	ON "WeeklyRankingNotification"("userId", "weekKey");
