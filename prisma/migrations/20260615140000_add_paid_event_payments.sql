CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "paidEventOrderId" TEXT NOT NULL,
    "registrationId" TEXT,
    "ticketId" TEXT,
    "ticketTierId" TEXT,
    "amount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "organizerAmount" INTEGER NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "mpesaRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_paidEventOrderId_key" ON "Payment"("paidEventOrderId");
CREATE UNIQUE INDEX "Payment_registrationId_key" ON "Payment"("registrationId");
CREATE UNIQUE INDEX "Payment_ticketId_key" ON "Payment"("ticketId");
CREATE INDEX "Payment_eventId_status_idx" ON "Payment"("eventId", "status");
CREATE INDEX "Payment_ticketTierId_status_idx" ON "Payment"("ticketTierId", "status");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_paidEventOrderId_fkey"
FOREIGN KEY ("paidEventOrderId") REFERENCES "PaidEventOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_ticketTierId_fkey"
FOREIGN KEY ("ticketTierId") REFERENCES "TicketTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
