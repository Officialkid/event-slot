-- ============================================================
-- Catch-up migration: records all changes applied via db push
-- that were never captured as migration files.
-- Mark as applied with: npx prisma migrate resolve --applied 20260418000000_catchup_db_push_changes
-- ============================================================

-- AlterTable: Event
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Registration
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "checkedIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "confirmationCode" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'form';

-- CreateIndex (Registration unique)
CREATE UNIQUE INDEX IF NOT EXISTS "Registration_qrCode_key" ON "Registration"("qrCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Registration_confirmationCode_key" ON "Registration"("confirmationCode");

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackCustomerCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackSubscriptionCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consentSystemEmails" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex (User unique)
CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackCustomerCode_key" ON "User"("paystackCustomerCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackSubscriptionCode_key" ON "User"("paystackSubscriptionCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateTable: CreditTransaction
CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (CreditTransaction)
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EventUnlock
CREATE TABLE IF NOT EXISTS "EventUnlock" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventUnlock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (EventUnlock)
ALTER TABLE "EventUnlock" ADD CONSTRAINT "EventUnlock_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EventInsight
CREATE TABLE IF NOT EXISTS "EventInsight" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (EventInsight unique)
CREATE UNIQUE INDEX IF NOT EXISTS "EventInsight_eventId_key" ON "EventInsight"("eventId");

-- AddForeignKey (EventInsight)
ALTER TABLE "EventInsight" ADD CONSTRAINT "EventInsight_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: FeatureAccess
CREATE TABLE IF NOT EXISTS "FeatureAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "feature" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureAccess_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (FeatureAccess)
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
