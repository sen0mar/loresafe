CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN');

CREATE TABLE "comments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "parent_id" UUID,
  "body" VARCHAR(8000) NOT NULL,
  "required_milestone_id" UUID NOT NULL,
  "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_body_not_empty_check" CHECK (length(btrim("body")) > 0)
);

CREATE INDEX "comments_post_id_status_deleted_at_created_at_idx"
  ON "comments"("post_id", "status", "deleted_at", "created_at");
CREATE INDEX "comments_post_id_required_milestone_id_idx"
  ON "comments"("post_id", "required_milestone_id");
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");
CREATE INDEX "comments_required_milestone_id_idx"
  ON "comments"("required_milestone_id");

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_required_milestone_id_fkey"
  FOREIGN KEY ("required_milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
