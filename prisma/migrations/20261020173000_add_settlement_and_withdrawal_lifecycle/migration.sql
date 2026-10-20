-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'DISPUTED', 'REVERSED');

-- AlterEnum
ALTER TYPE "WithdrawalStatus" ADD VALUE 'PENDING';
ALTER TYPE "WithdrawalStatus" ADD VALUE 'REVERSED';

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'WITHDRAWAL_RELEASE';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "settledAt" TIMESTAMP(3),
ADD COLUMN "settlementRef" TEXT,
ADD COLUMN "settlementBatchId" TEXT,
ADD COLUMN "settlementEvidence" JSONB;

-- CreateIndex
CREATE INDEX "Payment_settlementStatus_idx" ON "Payment"("settlementStatus");

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN "amountMinorUnits" BIGINT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "transferCode" TEXT,
ADD COLUMN "recipientCode" TEXT,
ADD COLUMN "settledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_idempotencyKey_key" ON "Withdrawal"("idempotencyKey");

-- CreateTable
CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "batchReference" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "totalAmountMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SettlementBatch_batchReference_key" ON "SettlementBatch"("batchReference");
CREATE INDEX "SettlementBatch_provider_settledAt_idx" ON "SettlementBatch"("provider", "settledAt");
