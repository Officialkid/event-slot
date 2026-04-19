/*
  Warnings:

  - You are about to drop the column `eventId` on the `OrganizerFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `OrganizerFeedback` table. All the data in the column will be lost.
  - Added the required column `organizerId` to the `OrganizerFeedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subject` to the `OrganizerFeedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `OrganizerFeedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `OrganizerFeedback` table without a default value. This is not possible if the table is not empty.

*/
-- Clear legacy rows that cannot satisfy new NOT NULL columns
DELETE FROM "OrganizerFeedback";

-- AlterTable
ALTER TABLE "OrganizerFeedback" DROP COLUMN "eventId",
DROP COLUMN "userId",
ADD COLUMN     "organizerId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'unread',
ADD COLUMN     "subject" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "rating" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OrganizerFeedback" ADD CONSTRAINT "OrganizerFeedback_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
