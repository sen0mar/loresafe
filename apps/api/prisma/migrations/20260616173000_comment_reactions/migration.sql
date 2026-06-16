CREATE TABLE "comment_reactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "comment_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "emoji" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comment_reactions_emoji_not_empty_check" CHECK (length(btrim("emoji")) > 0)
);

CREATE UNIQUE INDEX "comment_reactions_user_id_comment_id_emoji_unique"
  ON "comment_reactions"("user_id", "comment_id", "emoji");
CREATE INDEX "comment_reactions_comment_id_idx" ON "comment_reactions"("comment_id");
CREATE INDEX "comment_reactions_comment_id_emoji_idx"
  ON "comment_reactions"("comment_id", "emoji");
CREATE INDEX "comment_reactions_user_id_idx" ON "comment_reactions"("user_id");

ALTER TABLE "comment_reactions"
  ADD CONSTRAINT "comment_reactions_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comment_reactions"
  ADD CONSTRAINT "comment_reactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
