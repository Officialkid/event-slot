-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "feedbackSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AttendeeFeedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "enjoyed" TEXT,
    "improve" TEXT,
    "complaint" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendeeFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendeeFeedback_registrationId_key" ON "AttendeeFeedback"("registrationId");

-- AddForeignKey
ALTER TABLE "AttendeeFeedback" ADD CONSTRAINT "AttendeeFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
