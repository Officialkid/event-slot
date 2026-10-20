-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('TICKET_PROCEEDS', 'PLATFORM_COMMISSION', 'ORGANIZER_PAYOUT', 'WITHDRAWAL_RESERVATION', 'WITHDRAWAL_COMPLETION', 'REFUND', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ProcessedEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "eventId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "withdrawalId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountMinorUnits" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "idempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ProcessedEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "reference" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_idempotencyKey_key" ON "FinancialLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_organizerId_createdAt_idx" ON "FinancialLedgerEntry"("organizerId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_eventId_idx" ON "FinancialLedgerEntry"("eventId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_orderId_idx" ON "FinancialLedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_withdrawalId_idx" ON "FinancialLedgerEntry"("withdrawalId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_providerReference_idx" ON "FinancialLedgerEntry"("providerReference");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_entryType_createdAt_idx" ON "FinancialLedgerEntry"("entryType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedProviderEvent_idempotencyKey_key" ON "ProcessedProviderEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProcessedProviderEvent_provider_eventType_idx" ON "ProcessedProviderEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "ProcessedProviderEvent_reference_idx" ON "ProcessedProviderEvent"("reference");

-- CreateIndex
CREATE INDEX "ProcessedProviderEvent_status_lastAttemptAt_idx" ON "ProcessedProviderEvent"("status", "lastAttemptAt");

-- CreateIndex
CREATE INDEX "PaidEventOrder_providerReference_idx" ON "PaidEventOrder"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_mpesaRef_idx" ON "Payment"("mpesaRef");

-- CreateIndex
CREATE INDEX "Withdrawal_providerRef_idx" ON "Withdrawal"("providerRef");

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaidEventOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedProviderEvent" ADD CONSTRAINT "ProcessedProviderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaidEventOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedProviderEvent" ADD CONSTRAINT "ProcessedProviderEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
