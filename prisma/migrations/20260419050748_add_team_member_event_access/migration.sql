-- CreateTable
CREATE TABLE "TeamMemberEvent" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMemberEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberEvent_teamMemberId_eventId_key" ON "TeamMemberEvent"("teamMemberId", "eventId");

-- AddForeignKey
ALTER TABLE "TeamMemberEvent" ADD CONSTRAINT "TeamMemberEvent_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberEvent" ADD CONSTRAINT "TeamMemberEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
