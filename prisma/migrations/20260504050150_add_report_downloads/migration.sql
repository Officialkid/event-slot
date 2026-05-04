-- CreateTable
CREATE TABLE "ReportDownload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "downloadsRemaining" INTEGER NOT NULL DEFAULT 0,
    "totalPurchased" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDownloadTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bundleKey" TEXT NOT NULL,
    "amountKsh" INTEGER NOT NULL,
    "downloads" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDownloadTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDownload_userId_key" ON "ReportDownload"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDownloadTransaction_reference_key" ON "ReportDownloadTransaction"("reference");

-- AddForeignKey
ALTER TABLE "ReportDownload" ADD CONSTRAINT "ReportDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
