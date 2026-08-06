-- Add event visibility so organisers can choose whether an event is discoverable.
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

ALTER TABLE "Event"
ADD COLUMN "visibility" "EventVisibility" NOT NULL DEFAULT 'PRIVATE';
