CREATE TYPE "ClubVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'INVITE_ONLY');

CREATE TYPE "ClubMembershipRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

CREATE TABLE "clubs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "description" VARCHAR(280),
  "category" VARCHAR(60),
  "visibility" "ClubVisibility" NOT NULL DEFAULT 'PUBLIC',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "club_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "ClubMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "club_memberships_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "club_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "clubs_slug_unique" ON "clubs"("slug");

CREATE INDEX "clubs_visibility_idx" ON "clubs"("visibility");

CREATE UNIQUE INDEX "club_memberships_user_id_club_id_unique"
  ON "club_memberships"("user_id", "club_id");

CREATE INDEX "club_memberships_user_id_idx" ON "club_memberships"("user_id");

CREATE INDEX "club_memberships_club_id_idx" ON "club_memberships"("club_id");
