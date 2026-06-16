ALTER TYPE "NotificationType" ADD VALUE 'PROGRESS_UNLOCK';

ALTER TABLE "notifications"
ADD COLUMN "event_key" VARCHAR(160);

UPDATE "notifications"
SET "event_key" = 'legacy-notification:' || "id"::text
WHERE "event_key" IS NULL;

ALTER TABLE "notifications"
ALTER COLUMN "event_key" SET NOT NULL;

CREATE UNIQUE INDEX "notifications_event_key_unique"
ON "notifications" ("event_key");
