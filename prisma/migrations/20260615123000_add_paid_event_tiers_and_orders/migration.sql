-- Add ticket tiers for paid events without disturbing existing free-event data.
CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceKes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "bundleSize" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "waitlistCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaidEventOrder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL,
    "attendeePayload" JSONB NOT NULL,
    "attendeeEmail" TEXT,
    "attendeeName" TEXT,
    "attendeePhone" TEXT,
    "amountKes" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "checkoutRequestId" TEXT,
    "providerReference" TEXT,
    "mpesaReceiptNumber" TEXT,
    "mpesaPhone" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "promotionRegistrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaidEventOrder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Registration"
ADD COLUMN "ticketTierId" TEXT,
ADD COLUMN "paidOrderId" TEXT;

ALTER TABLE "Ticket"
ADD COLUMN "ticketTierId" TEXT,
ADD COLUMN "ticketTierName" TEXT,
ADD COLUMN "amountPaidKes" INTEGER;

CREATE UNIQUE INDEX "PaidEventOrder_checkoutRequestId_key" ON "PaidEventOrder"("checkoutRequestId");
CREATE UNIQUE INDEX "Registration_paidOrderId_key" ON "Registration"("paidOrderId");
CREATE INDEX "TicketTier_eventId_sortOrder_idx" ON "TicketTier"("eventId", "sortOrder");
CREATE INDEX "PaidEventOrder_eventId_status_idx" ON "PaidEventOrder"("eventId", "status");
CREATE INDEX "PaidEventOrder_ticketTierId_status_idx" ON "PaidEventOrder"("ticketTierId", "status");
CREATE INDEX "PaidEventOrder_holdExpiresAt_idx" ON "PaidEventOrder"("holdExpiresAt");

ALTER TABLE "TicketTier"
ADD CONSTRAINT "TicketTier_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaidEventOrder"
ADD CONSTRAINT "PaidEventOrder_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaidEventOrder"
ADD CONSTRAINT "PaidEventOrder_ticketTierId_fkey"
FOREIGN KEY ("ticketTierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Registration"
ADD CONSTRAINT "Registration_ticketTierId_fkey"
FOREIGN KEY ("ticketTierId") REFERENCES "TicketTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Registration"
ADD CONSTRAINT "Registration_paidOrderId_fkey"
FOREIGN KEY ("paidOrderId") REFERENCES "PaidEventOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_ticketTierId_fkey"
FOREIGN KEY ("ticketTierId") REFERENCES "TicketTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
