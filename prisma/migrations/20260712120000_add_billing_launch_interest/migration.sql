-- CreateTable
CREATE TABLE "BillingLaunchInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "accountType" TEXT,
    "previewMode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'billing_coming_soon_banner',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingLaunchInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingLaunchInterest_email_key" ON "BillingLaunchInterest"("email");

-- CreateIndex
CREATE INDEX "BillingLaunchInterest_createdAt_idx" ON "BillingLaunchInterest"("createdAt");

-- AddForeignKey
ALTER TABLE "BillingLaunchInterest" ADD CONSTRAINT "BillingLaunchInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
