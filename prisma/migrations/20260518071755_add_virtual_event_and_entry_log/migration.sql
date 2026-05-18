-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PHYSICAL', 'VIRTUAL');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KSh',
ADD COLUMN     "eventType" "EventType" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentsLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketPrice" INTEGER,
ADD COLUMN     "virtualLink" TEXT,
ADD COLUMN     "virtualLinkIv" TEXT;

-- CreateTable
CREATE TABLE "EntryLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "attendeeName" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "failReason" TEXT,

    CONSTRAINT "EntryLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EntryLog" ADD CONSTRAINT "EntryLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
