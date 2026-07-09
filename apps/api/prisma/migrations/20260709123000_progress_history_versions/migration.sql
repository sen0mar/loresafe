ALTER TABLE "club_progress"
  ALTER COLUMN "version" SET DEFAULT 0;

ALTER TABLE "progress_history"
  ADD COLUMN "progress_version" INTEGER;

WITH ranked_history AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", "club_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS "progress_version"
  FROM "progress_history"
)
UPDATE "progress_history" AS history
SET "progress_version" = ranked."progress_version"
FROM ranked_history AS ranked
WHERE history."id" = ranked."id";

ALTER TABLE "progress_history"
  ALTER COLUMN "progress_version" SET NOT NULL;

CREATE UNIQUE INDEX "progress_history_user_club_version_unique"
  ON "progress_history"("user_id", "club_id", "progress_version");

UPDATE "club_progress" AS progress
SET "version" = COALESCE(history."max_version", 0)
FROM (
  SELECT "user_id", "club_id", MAX("progress_version") AS "max_version"
  FROM "progress_history"
  GROUP BY "user_id", "club_id"
) AS history
WHERE progress."user_id" = history."user_id"
  AND progress."club_id" = history."club_id";

UPDATE "club_progress"
SET "version" = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM "progress_history"
  WHERE "progress_history"."user_id" = "club_progress"."user_id"
    AND "progress_history"."club_id" = "club_progress"."club_id"
);

ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_version_positive_check"
  CHECK ("progress_version" > 0);

ALTER TABLE "club_progress"
  ADD CONSTRAINT "club_progress_version_nonnegative_check"
  CHECK ("version" >= 0);
