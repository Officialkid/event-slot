CREATE TABLE "EmailOTP" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "otp" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOTP_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailOTP_email_otp_idx" ON "EmailOTP"("email", "otp");
