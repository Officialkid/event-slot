-- Add marketingConsent field to User table
ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- Create AuditLog table for broadcast tracking
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient audit log queries
CREATE INDEX "idx_audit_log_actor_id" ON "AuditLog"("actorId");
CREATE INDEX "idx_audit_log_action" ON "AuditLog"("action");
CREATE INDEX "idx_audit_log_created_at" ON "AuditLog"("createdAt");
