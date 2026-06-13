CREATE TABLE "club_invites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "max_uses" INTEGER NOT NULL,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "club_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "club_invites_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "club_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "club_invites_max_uses_positive_check" CHECK ("max_uses" > 0),
  CONSTRAINT "club_invites_used_count_nonnegative_check" CHECK ("used_count" >= 0),
  CONSTRAINT "club_invites_used_count_max_uses_check" CHECK ("used_count" <= "max_uses")
);

CREATE UNIQUE INDEX "club_invites_token_hash_unique"
  ON "club_invites"("token_hash");

CREATE INDEX "club_invites_club_id_created_at_idx"
  ON "club_invites"("club_id", "created_at");

CREATE INDEX "club_invites_created_by_id_idx"
  ON "club_invites"("created_by_id");

CREATE INDEX "club_invites_expires_at_idx"
  ON "club_invites"("expires_at");
