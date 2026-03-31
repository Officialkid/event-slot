-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "planEndDate" TIMESTAMP(3),
ADD COLUMN     "planStartDate" TIMESTAMP(3);
