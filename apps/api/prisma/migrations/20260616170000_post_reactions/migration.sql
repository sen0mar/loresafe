CREATE TABLE "post_reactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "emoji" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "post_reactions_emoji_not_empty_check" CHECK (length(btrim("emoji")) > 0)
);

CREATE UNIQUE INDEX "post_reactions_user_id_post_id_emoji_unique"
  ON "post_reactions"("user_id", "post_id", "emoji");
CREATE INDEX "post_reactions_post_id_idx" ON "post_reactions"("post_id");
CREATE INDEX "post_reactions_post_id_emoji_idx"
  ON "post_reactions"("post_id", "emoji");
CREATE INDEX "post_reactions_user_id_idx" ON "post_reactions"("user_id");

ALTER TABLE "post_reactions"
  ADD CONSTRAINT "post_reactions_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_reactions"
  ADD CONSTRAINT "post_reactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
