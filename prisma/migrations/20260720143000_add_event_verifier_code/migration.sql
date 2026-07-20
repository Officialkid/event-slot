ALTER TABLE "Event"
ADD COLUMN "verifierCode" TEXT,
ADD COLUMN "verifierCodeEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Event"
SET "verifierCode" = 'EV-' || UPPER(SUBSTRING(MD5("id" || "dashboardToken") FROM 1 FOR 8))
WHERE "verifierCode" IS NULL;

CREATE UNIQUE INDEX "Event_verifierCode_key" ON "Event"("verifierCode");
