CREATE TYPE "NotificationType" AS ENUM (
  'POST_COMMENT',
  'COMMENT_REPLY'
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "safe_text" VARCHAR(240) NOT NULL,
  "club_id" UUID NOT NULL,
  "post_id" UUID,
  "comment_id" UUID,
  "required_milestone_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_safe_text_not_empty_check" CHECK (length(btrim("safe_text")) > 0)
);

CREATE INDEX "notifications_user_id_read_at_created_at_idx"
  ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_user_id_created_at_idx"
  ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_club_id_idx" ON "notifications"("club_id");
CREATE INDEX "notifications_post_id_idx" ON "notifications"("post_id");
CREATE INDEX "notifications_comment_id_idx" ON "notifications"("comment_id");
CREATE INDEX "notifications_required_milestone_id_idx"
  ON "notifications"("required_milestone_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_required_milestone_id_fkey"
  FOREIGN KEY ("required_milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
