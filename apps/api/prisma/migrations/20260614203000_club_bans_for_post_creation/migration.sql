CREATE TABLE "club_bans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "reason" VARCHAR(500),
  "expires_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "club_bans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "club_bans_user_id_club_id_idx"
  ON "club_bans"("user_id", "club_id");

CREATE INDEX "club_bans_active_lookup_idx"
  ON "club_bans"("club_id", "user_id", "revoked_at", "expires_at");

CREATE INDEX "club_bans_active_unrevoked_idx"
  ON "club_bans"("club_id", "user_id", "expires_at")
  WHERE "revoked_at" IS NULL;

ALTER TABLE "club_bans"
  ADD CONSTRAINT "club_bans_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_bans"
  ADD CONSTRAINT "club_bans_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
