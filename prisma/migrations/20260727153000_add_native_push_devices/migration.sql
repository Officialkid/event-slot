CREATE TABLE "NativePushDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceName" TEXT,
  "experienceId" TEXT,
  "platform" TEXT NOT NULL,
  "pushToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRegisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NativePushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NativePushDevice_pushToken_key" ON "NativePushDevice"("pushToken");
CREATE UNIQUE INDEX "NativePushDevice_userId_deviceId_key" ON "NativePushDevice"("userId", "deviceId");
CREATE INDEX "NativePushDevice_userId_platform_idx" ON "NativePushDevice"("userId", "platform");

ALTER TABLE "NativePushDevice"
ADD CONSTRAINT "NativePushDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
