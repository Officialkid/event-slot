-- CreateTable
CREATE TABLE "OrganizerFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "rating" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerFeedback_pkey" PRIMARY KEY ("id")
);
