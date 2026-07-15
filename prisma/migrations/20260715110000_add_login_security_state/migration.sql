CREATE TABLE "LoginSecurityState" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginSecurityState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginSecurityState_email_key" ON "LoginSecurityState"("email");
