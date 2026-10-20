-- AlterEnum
ALTER TYPE "PaidOrderStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "PaidEventOrder" ADD COLUMN "fulfillmentStatus" TEXT,
ADD COLUMN "exceptionReason" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolutionNotes" TEXT;

-- CreateIndex
CREATE INDEX "PaidEventOrder_status_fulfillmentStatus_idx" ON "PaidEventOrder"("status", "fulfillmentStatus");
