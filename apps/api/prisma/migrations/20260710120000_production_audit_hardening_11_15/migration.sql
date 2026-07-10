ALTER TABLE "audit_logs"
  ADD COLUMN "actor_display_name" VARCHAR(80),
  ADD COLUMN "actor_username" VARCHAR(30),
  ADD COLUMN "club_title" VARCHAR(120),
  ADD COLUMN "club_link_name" VARCHAR(80);

UPDATE "audit_logs" AS audit_log
SET
  "actor_display_name" = actor."display_name",
  "actor_username" = actor."username",
  "club_title" = club."title",
  "club_link_name" = club."link_name"
FROM "users" AS actor, "clubs" AS club
WHERE audit_log."actor_id" = actor."id"
  AND audit_log."club_id" = club."id";

ALTER TABLE "audit_logs"
  ALTER COLUMN "actor_display_name" SET NOT NULL,
  ALTER COLUMN "actor_username" SET NOT NULL,
  ALTER COLUMN "club_title" SET NOT NULL,
  ALTER COLUMN "club_link_name" SET NOT NULL,
  ALTER COLUMN "actor_id" DROP NOT NULL,
  ALTER COLUMN "club_id" DROP NOT NULL;

ALTER TABLE "audit_logs"
  DROP CONSTRAINT "audit_logs_actor_id_fkey",
  DROP CONSTRAINT "audit_logs_club_id_fkey";

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "audit_logs_club_id_fkey"
    FOREIGN KEY ("club_id") REFERENCES "clubs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
