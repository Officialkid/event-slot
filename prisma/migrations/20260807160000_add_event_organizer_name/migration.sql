ALTER TABLE "Event"
ADD COLUMN "organizerName" TEXT;

UPDATE "Event" AS e
SET "organizerName" = COALESCE(NULLIF(TRIM(u."name"), ''), e."organizerEmail")
FROM "User" AS u
WHERE e."organizerId" = u."id"
  AND e."organizerName" IS NULL;

UPDATE "Event"
SET "organizerName" = "organizerEmail"
WHERE "organizerName" IS NULL;
