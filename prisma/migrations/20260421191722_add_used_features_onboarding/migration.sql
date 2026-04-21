-- AlterTable
ALTER TABLE "UserOnboarding" ADD COLUMN     "usedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
