-- CreateTable
CREATE TABLE "OrganiserBalance" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "grossKES" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionKES" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netKES" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawnKES" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawnUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganiserBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "WithdrawalMethod" NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PROCESSING',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganiserBalance_organiserId_key" ON "OrganiserBalance"("organiserId");

-- CreateIndex
CREATE INDEX "Withdrawal_organiserId_currency_createdAt_idx" ON "Withdrawal"("organiserId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_organiserId_status_idx" ON "Withdrawal"("organiserId", "status");

-- AddForeignKey
ALTER TABLE "OrganiserBalance" ADD CONSTRAINT "OrganiserBalance_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
