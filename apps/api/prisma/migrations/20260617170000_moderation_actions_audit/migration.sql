ALTER TYPE "NotificationType" ADD VALUE 'MODERATION_WARNING';

CREATE TYPE "AuditLogAction" AS ENUM (
  'POST_REQUIRED_MILESTONE_CHANGED',
  'POST_HIDDEN',
  'POST_DELETED',
  'COMMENT_REQUIRED_MILESTONE_CHANGED',
  'COMMENT_HIDDEN',
  'COMMENT_DELETED',
  'USER_WARNED',
  'USER_BANNED',
  'REPORT_RESOLVED',
  'REPORT_DISMISSED'
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" "AuditLogAction" NOT NULL,
  "actor_id" UUID NOT NULL,
  "club_id" UUID NOT NULL,
  "report_id" UUID,
  "post_id" UUID,
  "comment_id" UUID,
  "target_user_id" UUID,
  "moderator_note" VARCHAR(1000),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_moderator_note_not_empty_check"
    CHECK ("moderator_note" IS NULL OR length(btrim("moderator_note")) > 0)
);

CREATE INDEX "audit_logs_club_id_created_at_idx"
  ON "audit_logs"("club_id", "created_at");
CREATE INDEX "audit_logs_club_id_action_created_at_idx"
  ON "audit_logs"("club_id", "action", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx"
  ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_target_user_id_created_at_idx"
  ON "audit_logs"("target_user_id", "created_at");
CREATE INDEX "audit_logs_report_id_idx" ON "audit_logs"("report_id");
CREATE INDEX "audit_logs_post_id_idx" ON "audit_logs"("post_id");
CREATE INDEX "audit_logs_comment_id_idx" ON "audit_logs"("comment_id");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
