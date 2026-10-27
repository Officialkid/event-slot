-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showFollowerCountPublicly" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Event
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "announcementSentAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "firstPublishedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "timedDropEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "ticketDropOpensAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "ticketDropClosesAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "dropWaitlistOnExpire" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable OrganiserFollower
CREATE TABLE IF NOT EXISTS "OrganiserFollower" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "notifyNewEvents" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganiserFollower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrganiserFollower_followerId_organiserId_key" ON "OrganiserFollower"("followerId", "organiserId");
CREATE INDEX IF NOT EXISTS "OrganiserFollower_organiserId_idx" ON "OrganiserFollower"("organiserId");
CREATE INDEX IF NOT EXISTS "OrganiserFollower_followerId_idx" ON "OrganiserFollower"("followerId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganiserFollower_followerId_fkey') THEN
        ALTER TABLE "OrganiserFollower" ADD CONSTRAINT "OrganiserFollower_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganiserFollower_organiserId_fkey') THEN
        ALTER TABLE "OrganiserFollower" ADD CONSTRAINT "OrganiserFollower_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
