ALTER TYPE "NotificationType" ADD VALUE 'SECURITY_ALERT';

CREATE TYPE "SecurityEventType" AS ENUM ('REFRESH_TOKEN_REUSE');

ALTER TABLE "auth_sessions"
  ADD COLUMN "token_family_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "auth_sessions_generation_positive_check" CHECK ("generation" > 0);

CREATE INDEX "auth_sessions_family_active_idx"
  ON "auth_sessions"("token_family_id", "revoked_at");

CREATE TABLE "auth_refresh_token_tombstones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "generation" INTEGER NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "spent_at" TIMESTAMPTZ(6) NOT NULL,
  "grace_until" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "auth_refresh_token_tombstones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_refresh_tombstones_generation_positive_check" CHECK ("generation" > 0),
  CONSTRAINT "auth_refresh_tombstones_window_check" CHECK (
    "spent_at" <= "grace_until" AND "grace_until" < "expires_at"
  )
);

CREATE UNIQUE INDEX "auth_refresh_tombstones_token_hash_unique"
  ON "auth_refresh_token_tombstones"("token_hash");
CREATE INDEX "auth_refresh_tombstones_family_generation_idx"
  ON "auth_refresh_token_tombstones"("family_id", "generation");
CREATE INDEX "auth_refresh_tombstones_expires_at_idx"
  ON "auth_refresh_token_tombstones"("expires_at");

ALTER TABLE "auth_refresh_token_tombstones"
  ADD CONSTRAINT "auth_refresh_token_tombstones_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "type" "SecurityEventType" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_events_family_type_unique"
  ON "security_events"("family_id", "type");
CREATE INDEX "security_events_user_created_at_idx"
  ON "security_events"("user_id", "created_at");

ALTER TABLE "security_events"
  ADD CONSTRAINT "security_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ALTER COLUMN "club_id" DROP NOT NULL,
  ALTER COLUMN "required_milestone_id" DROP NOT NULL,
  ADD CONSTRAINT "notifications_security_shape_check" CHECK (
    (
      "type" = 'SECURITY_ALERT'
      AND "club_id" IS NULL
      AND "post_id" IS NULL
      AND "comment_id" IS NULL
      AND "required_milestone_id" IS NULL
    )
    OR
    (
      "type" <> 'SECURITY_ALERT'
      AND "club_id" IS NOT NULL
      AND "required_milestone_id" IS NOT NULL
    )
  );

ALTER TABLE "audit_logs"
  ADD COLUMN "actor_anonymized_at" TIMESTAMPTZ(6);

UPDATE "audit_logs"
SET
  "actor_display_name" = 'Deleted user',
  "actor_username" = 'deleted-account',
  "actor_anonymized_at" = CURRENT_TIMESTAMP
WHERE "actor_id" IS NULL;

CREATE INDEX "audit_logs_anonymized_created_at_idx"
  ON "audit_logs"("actor_anonymized_at", "created_at");
