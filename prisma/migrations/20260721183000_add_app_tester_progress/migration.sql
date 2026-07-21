CREATE TABLE "AppTesterProgress" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviteSentAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppTesterProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppTesterSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "promptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppTesterSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppTesterProgress_email_key" ON "AppTesterProgress"("email");
