CREATE TYPE "PostType" AS ENUM (
  'DISCUSSION',
  'QUESTION',
  'THEORY',
  'PREDICTION',
  'POLL',
  'REACTION',
  'REVIEW',
  'IMAGE_MEME',
  'QUOTE_COMMENTARY',
  'JUST_REACHED'
);

CREATE TYPE "PostStatus" AS ENUM ('VISIBLE', 'HIDDEN');

CREATE TABLE "posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "type" "PostType" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(8000) NOT NULL,
  "required_milestone_id" UUID NOT NULL,
  "status" "PostStatus" NOT NULL DEFAULT 'VISIBLE',
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "posts_title_not_empty_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "posts_body_not_empty_check" CHECK (length(btrim("body")) > 0)
);

CREATE INDEX "posts_club_id_status_deleted_at_created_at_idx"
  ON "posts"("club_id", "status", "deleted_at", "created_at");
CREATE INDEX "posts_club_id_required_milestone_id_idx"
  ON "posts"("club_id", "required_milestone_id");
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");
CREATE INDEX "posts_required_milestone_id_idx" ON "posts"("required_milestone_id");

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_required_milestone_id_fkey"
  FOREIGN KEY ("required_milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
