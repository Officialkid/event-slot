-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentTransactional" BOOLEAN NOT NULL DEFAULT false;
