-- CreateIndex
CREATE INDEX "Registration_paidOrderId_idx" ON "Registration"("paidOrderId");

-- CreateIndex
CREATE INDEX "Registration_eventId_attendeeEmail_idx" ON "Registration"("eventId", "attendeeEmail");
