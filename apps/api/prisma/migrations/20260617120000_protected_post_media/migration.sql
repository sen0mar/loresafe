ALTER TYPE "FileAssetPurpose" ADD VALUE 'POST_IMAGE';
ALTER TYPE "FileAssetVisibility" ADD VALUE 'PRIVATE';

ALTER TABLE "file_assets"
  ADD COLUMN "post_id" UUID,
  ADD COLUMN "comment_id" UUID,
  ADD COLUMN "safe_preview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_post_image_private_check"
  CHECK ("purpose" <> 'POST_IMAGE' OR "visibility" = 'PRIVATE');

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_post_image_has_club_check"
  CHECK ("purpose" <> 'POST_IMAGE' OR "club_id" IS NOT NULL);

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_public_assets_not_attached_to_content_check"
  CHECK ("purpose" IN ('POST_IMAGE') OR ("post_id" IS NULL AND "comment_id" IS NULL AND "safe_preview" = false));

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_one_content_parent_check"
  CHECK (num_nonnulls("post_id", "comment_id") <= 1);

CREATE INDEX "file_assets_post_purpose_status_idx"
  ON "file_assets"("post_id", "purpose", "status");

CREATE INDEX "file_assets_comment_purpose_status_idx"
  ON "file_assets"("comment_id", "purpose", "status");
