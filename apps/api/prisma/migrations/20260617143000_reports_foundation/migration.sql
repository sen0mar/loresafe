CREATE TYPE "ReportTargetType" AS ENUM (
  'POST',
  'COMMENT'
);

CREATE TYPE "ReportReason" AS ENUM (
  'SPOILER',
  'HARASSMENT',
  'HATE',
  'SPAM',
  'OFF_TOPIC',
  'OTHER'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'OPEN',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "target_type" "ReportTargetType" NOT NULL,
  "reason" "ReportReason" NOT NULL,
  "details" VARCHAR(1000),
  "reporter_id" UUID NOT NULL,
  "club_id" UUID NOT NULL,
  "post_id" UUID,
  "comment_id" UUID,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_details_not_empty_check" CHECK ("details" IS NULL OR length(btrim("details")) > 0),
  CONSTRAINT "reports_exactly_one_target_check" CHECK (num_nonnulls("post_id", "comment_id") = 1),
  CONSTRAINT "reports_target_type_matches_target_check" CHECK (
    ("target_type" = 'POST' AND "post_id" IS NOT NULL AND "comment_id" IS NULL)
    OR
    ("target_type" = 'COMMENT' AND "comment_id" IS NOT NULL AND "post_id" IS NULL)
  )
);

CREATE UNIQUE INDEX "reports_reporter_id_post_id_open_unique"
  ON "reports"("reporter_id", "post_id")
  WHERE "status" = 'OPEN' AND "post_id" IS NOT NULL;

CREATE UNIQUE INDEX "reports_reporter_id_comment_id_open_unique"
  ON "reports"("reporter_id", "comment_id")
  WHERE "status" = 'OPEN' AND "comment_id" IS NOT NULL;

CREATE INDEX "reports_club_id_status_created_at_idx"
  ON "reports"("club_id", "status", "created_at");
CREATE INDEX "reports_reporter_id_created_at_idx"
  ON "reports"("reporter_id", "created_at");
CREATE INDEX "reports_post_id_idx" ON "reports"("post_id");
CREATE INDEX "reports_comment_id_idx" ON "reports"("comment_id");

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
