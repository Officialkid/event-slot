-- MD4: Conversation memory preference and stored memory summary
CREATE TABLE IF NOT EXISTS "UserMemoryPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "memoryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMemoryPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserMemoryPreference_userId_key" ON "UserMemoryPreference"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'UserMemoryPreference_userId_fkey'
      AND table_name = 'UserMemoryPreference'
  ) THEN
    ALTER TABLE "UserMemoryPreference"
      ADD CONSTRAINT "UserMemoryPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "keyFacts" JSONB NOT NULL,
  "sessionCount" INTEGER NOT NULL DEFAULT 0,
  "lastUpdated" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserMemory_userId_key" ON "UserMemory"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'UserMemory_userId_fkey'
      AND table_name = 'UserMemory'
  ) THEN
    ALTER TABLE "UserMemory"
      ADD CONSTRAINT "UserMemory_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
