CREATE TABLE "RegistrationDraft" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "attendeeCount" INTEGER NOT NULL DEFAULT 1,
    "baseEmails" JSONB,
    "consentDataProcessing" BOOLEAN NOT NULL DEFAULT false,
    "consentTransactional" BOOLEAN NOT NULL DEFAULT false,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "sendResponseCopy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationDraft_eventId_email_key" ON "RegistrationDraft"("eventId", "email");
CREATE INDEX "RegistrationDraft_email_idx" ON "RegistrationDraft"("email");

ALTER TABLE "RegistrationDraft" ADD CONSTRAINT "RegistrationDraft_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
