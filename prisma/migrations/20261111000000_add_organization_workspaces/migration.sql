-- ==============================================================================
-- Migration: Add Organization Workspaces & Multi-User Teams Architecture
-- Timestamp: 20261111000000
-- ==============================================================================

-- 1. Create Enums safely with IF NOT EXISTS checks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationRole') THEN
    CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'EVENT_MANAGER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationMemberStatus') THEN
    CREATE TYPE "OrganizationMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationPublicationStatus') THEN
    CREATE TYPE "OrganizationPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationVerificationStatus') THEN
    CREATE TYPE "OrganizationVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationInvitationType') THEN
    CREATE TYPE "OrganizationInvitationType" AS ENUM ('EMAIL', 'LINK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationInvitationStatus') THEN
    CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', 'DECLINED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationFinanceStatus') THEN
    CREATE TYPE "OrganizationFinanceStatus" AS ENUM ('UNCONFIGURED', 'PENDING_REVIEW', 'ENABLED', 'RESTRICTED', 'DISABLED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventTransferStatus') THEN
    CREATE TYPE "EventTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

-- 2. Create Organization Table
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "description" TEXT,
  "logo" TEXT,
  "coverImage" TEXT,
  "category" TEXT,
  "website" TEXT,
  "socialLinks" JSONB,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "contactWhatsapp" TEXT,
  "publicationStatus" "OrganizationPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "verificationStatus" "OrganizationVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt" TIMESTAMP(3),
  "verificationEvidence" JSONB,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Organization_handle_key" UNIQUE ("handle"),
  CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Organization_handle_idx" ON "Organization"("handle");
CREATE INDEX IF NOT EXISTS "Organization_publicationStatus_idx" ON "Organization"("publicationStatus");
CREATE INDEX IF NOT EXISTS "Organization_verificationStatus_idx" ON "Organization"("verificationStatus");
CREATE INDEX IF NOT EXISTS "Organization_createdById_idx" ON "Organization"("createdById");

-- 3. Create OrganizationMember Table
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL DEFAULT 'EVENT_MANAGER',
  "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationMember_organizationId_userId_key" UNIQUE ("organizationId", "userId"),
  CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_status_idx" ON "OrganizationMember"("status");

-- 4. Create OrganizationInvitation Table
CREATE TABLE IF NOT EXISTS "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "OrganizationInvitationType" NOT NULL DEFAULT 'EMAIL',
  "email" TEXT,
  "tokenHash" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL DEFAULT 'EVENT_MANAGER',
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usesCount" INTEGER NOT NULL DEFAULT 0,
  "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationInvitation_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrganizationInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationInvitation_tokenHash_idx" ON "OrganizationInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");
CREATE INDEX IF NOT EXISTS "OrganizationInvitation_status_idx" ON "OrganizationInvitation"("status");

-- 5. Create OrganizationFollower Table
CREATE TABLE IF NOT EXISTS "OrganizationFollower" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "notifyNewEvents" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationFollower_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationFollower_followerId_organizationId_key" UNIQUE ("followerId", "organizationId"),
  CONSTRAINT "OrganizationFollower_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationFollower_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationFollower_organizationId_idx" ON "OrganizationFollower"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationFollower_followerId_idx" ON "OrganizationFollower"("followerId");

-- 6. Create OrganizationAuditLog Table
CREATE TABLE IF NOT EXISTS "OrganizationAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationAuditLog_organizationId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationAuditLog_action_idx" ON "OrganizationAuditLog"("action");

-- 7. Create OrganizationVerificationRequest Table
CREATE TABLE IF NOT EXISTS "OrganizationVerificationRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "OrganizationVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "evidence" JSONB,
  "reviewedById" TEXT,
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationVerificationRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationVerificationRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationVerificationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationVerificationRequest_organizationId_idx" ON "OrganizationVerificationRequest"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationVerificationRequest_status_idx" ON "OrganizationVerificationRequest"("status");

-- 8. Create OrganizationFinanceProfile Table
CREATE TABLE IF NOT EXISTS "OrganizationFinanceProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "OrganizationFinanceStatus" NOT NULL DEFAULT 'UNCONFIGURED',
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "payoutMethod" TEXT,
  "beneficiaryName" TEXT,
  "settlementNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationFinanceProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationFinanceProfile_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "OrganizationFinanceProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationFinanceProfile_status_idx" ON "OrganizationFinanceProfile"("status");

-- 9. Create EventTransferRequest Table
CREATE TABLE IF NOT EXISTS "EventTransferRequest" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceOwnerType" TEXT NOT NULL,
  "sourceOwnerId" TEXT NOT NULL,
  "targetOwnerType" TEXT NOT NULL,
  "targetOwnerId" TEXT NOT NULL,
  "status" "EventTransferStatus" NOT NULL DEFAULT 'PENDING',
  "initiatedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EventTransferRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventTransferRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventTransferRequest_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EventTransferRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EventTransferRequest_eventId_idx" ON "EventTransferRequest"("eventId");
CREATE INDEX IF NOT EXISTS "EventTransferRequest_status_idx" ON "EventTransferRequest"("status");

-- 10. Alter Event Table for explicit Organization & Creator attribution
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "creatorId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Event_organizationId_fkey'
  ) THEN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Event_creatorId_fkey'
  ) THEN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_creatorId_fkey"
      FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Event_organizationId_idx" ON "Event"("organizationId");
CREATE INDEX IF NOT EXISTS "Event_creatorId_idx" ON "Event"("creatorId");

-- 11. Data Backfill: Preserve legacy creator attribution
UPDATE "Event"
SET "creatorId" = "organizerId"
WHERE "creatorId" IS NULL AND "organizerId" IS NOT NULL;
