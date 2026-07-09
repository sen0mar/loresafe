-- Progress commands are serialized and deduplicated per user/club.
CREATE TYPE "ProgressCommandType" AS ENUM ('UPDATE', 'ADVANCE_NEXT');
CREATE TYPE "StorageDeletionReason" AS ENUM (
  'INVALID_UPLOAD',
  'EXPIRED_UPLOAD',
  'UNATTACHED_POST_IMAGE',
  'REPLACED_ASSET',
  'ACCOUNT_DELETION'
);
CREATE TYPE "StorageDeletionStatus" AS ENUM ('PENDING', 'COMPLETED');

ALTER TABLE "club_progress"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "file_assets"
  ADD COLUMN "width_px" INTEGER,
  ADD COLUMN "height_px" INTEGER,
  ADD COLUMN "is_animated" BOOLEAN,
  ADD COLUMN "validated_at" TIMESTAMPTZ(6);

CREATE TABLE "progress_commands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "command_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "club_id" UUID NOT NULL,
  "type" "ProgressCommandType" NOT NULL,
  "fingerprint" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progress_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "progress_commands_user_club_command_unique"
  ON "progress_commands"("user_id", "club_id", "command_id");
CREATE INDEX "progress_commands_created_at_idx"
  ON "progress_commands"("created_at");

ALTER TABLE "progress_commands"
  ADD CONSTRAINT "progress_commands_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_commands"
  ADD CONSTRAINT "progress_commands_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "storage_object_deletions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "object_key" VARCHAR(512) NOT NULL,
  "reason" "StorageDeletionReason" NOT NULL,
  "status" "StorageDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(500),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "storage_object_deletions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storage_object_deletions_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "storage_object_deletions_completion_check" CHECK (
    ("status" = 'PENDING' AND "completed_at" IS NULL)
    OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "storage_object_deletions_object_key_unique"
  ON "storage_object_deletions"("object_key");
CREATE INDEX "storage_object_deletions_status_updated_at_idx"
  ON "storage_object_deletions"("status", "updated_at");

-- Compound keys let PostgreSQL enforce same-club references directly.
ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_id_club_id_unique" UNIQUE ("id", "club_id");
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_id_club_id_unique" UNIQUE ("id", "club_id");

ALTER TABLE "club_progress"
  ADD CONSTRAINT "club_progress_current_milestone_same_club_fkey"
  FOREIGN KEY ("current_milestone_id", "club_id")
  REFERENCES "milestones"("id", "club_id") ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_from_milestone_same_club_fkey"
  FOREIGN KEY ("from_milestone_id", "club_id")
  REFERENCES "milestones"("id", "club_id") ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_to_milestone_same_club_fkey"
  FOREIGN KEY ("to_milestone_id", "club_id")
  REFERENCES "milestones"("id", "club_id") ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_required_milestone_same_club_fkey"
  FOREIGN KEY ("required_milestone_id", "club_id")
  REFERENCES "milestones"("id", "club_id") ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_required_milestone_same_club_fkey"
  FOREIGN KEY ("required_milestone_id", "club_id")
  REFERENCES "milestones"("id", "club_id") ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_post_same_club_fkey"
  FOREIGN KEY ("post_id", "club_id")
  REFERENCES "posts"("id", "club_id") ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_post_same_club_fkey"
  FOREIGN KEY ("post_id", "club_id")
  REFERENCES "posts"("id", "club_id") ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_post_same_club_fkey"
  FOREIGN KEY ("post_id", "club_id")
  REFERENCES "posts"("id", "club_id") ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_target_shape_check" CHECK (
    ("target_type" = 'POST' AND "post_id" IS NOT NULL AND "comment_id" IS NULL)
    OR
    ("target_type" = 'COMMENT' AND "post_id" IS NULL AND "comment_id" IS NOT NULL)
  );

-- Legacy safe-preview flags never represented a trusted derived asset.
UPDATE "file_assets" SET "safe_preview" = FALSE WHERE "safe_preview" = TRUE;

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_purpose_shape_check" CHECK (
    ("purpose" = 'AVATAR'
      AND "club_id" IS NULL AND "post_id" IS NULL AND "comment_id" IS NULL
      AND "visibility" = 'PUBLIC' AND "safe_preview" = FALSE)
    OR
    ("purpose" = 'CLUB_COVER'
      AND "club_id" IS NOT NULL AND "post_id" IS NULL AND "comment_id" IS NULL
      AND "visibility" = 'PUBLIC' AND "safe_preview" = FALSE)
    OR
    ("purpose" = 'POST_IMAGE'
      AND "club_id" IS NOT NULL AND "comment_id" IS NULL
      AND "visibility" = 'PRIVATE' AND "safe_preview" = FALSE)
  );

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_image_dimensions_check" CHECK (
    ("width_px" IS NULL AND "height_px" IS NULL AND "is_animated" IS NULL AND "validated_at" IS NULL)
    OR
    ("width_px" > 0 AND "height_px" > 0 AND "is_animated" IS NOT NULL AND "validated_at" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION "enforce_loresafe_cross_record_invariants"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  related_club_id UUID;
  related_post_id UUID;
  related_owner_id UUID;
  related_purpose "FileAssetPurpose";
BEGIN
  IF TG_TABLE_NAME = 'milestones' AND TG_OP = 'UPDATE' AND NEW.club_id <> OLD.club_id THEN
    RAISE EXCEPTION 'A milestone cannot move between clubs' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'posts' AND TG_OP = 'UPDATE' AND NEW.club_id <> OLD.club_id THEN
    RAISE EXCEPTION 'A post cannot move between clubs' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'comments' THEN
    SELECT p.club_id INTO related_club_id FROM posts p WHERE p.id = NEW.post_id;
    IF NOT EXISTS (
      SELECT 1 FROM milestones m
      WHERE m.id = NEW.required_milestone_id AND m.club_id = related_club_id
    ) THEN
      RAISE EXCEPTION 'Comment milestone must belong to the post club' USING ERRCODE = '23514';
    END IF;
    IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM comments parent
      WHERE parent.id = NEW.parent_id AND parent.post_id = NEW.post_id
    ) THEN
      RAISE EXCEPTION 'Comment parent must belong to the same post' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'predictions' THEN
    SELECT p.club_id INTO related_club_id FROM posts p WHERE p.id = NEW.post_id;
    IF NOT EXISTS (
      SELECT 1 FROM milestones m
      WHERE m.id = NEW.reveal_milestone_id AND m.club_id = related_club_id
    ) THEN
      RAISE EXCEPTION 'Prediction reveal milestone must belong to the post club' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'notifications' AND NEW.comment_id IS NOT NULL THEN
    SELECT p.club_id, c.post_id
      INTO related_club_id, related_post_id
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      WHERE c.id = NEW.comment_id;
    IF related_club_id IS DISTINCT FROM NEW.club_id
      OR (NEW.post_id IS NOT NULL AND related_post_id IS DISTINCT FROM NEW.post_id) THEN
      RAISE EXCEPTION 'Notification targets must belong to the same club and post' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'reports' AND NEW.comment_id IS NOT NULL THEN
    SELECT p.club_id INTO related_club_id
      FROM comments c JOIN posts p ON p.id = c.post_id
      WHERE c.id = NEW.comment_id;
    IF related_club_id IS DISTINCT FROM NEW.club_id THEN
      RAISE EXCEPTION 'Report target must belong to the report club' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'file_assets' AND NEW.post_id IS NOT NULL THEN
    SELECT p.author_id INTO related_owner_id FROM posts p WHERE p.id = NEW.post_id;
    IF related_owner_id IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Post media owner must match the post author' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'users' AND NEW.avatar_asset_id IS NOT NULL THEN
    SELECT f.owner_id, f.purpose INTO related_owner_id, related_purpose
      FROM file_assets f WHERE f.id = NEW.avatar_asset_id;
    IF related_owner_id IS DISTINCT FROM NEW.id OR related_purpose IS DISTINCT FROM 'AVATAR' THEN
      RAISE EXCEPTION 'Avatar asset must belong to the user and have avatar purpose' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'clubs' AND NEW.cover_asset_id IS NOT NULL THEN
    SELECT f.club_id, f.purpose INTO related_club_id, related_purpose
      FROM file_assets f WHERE f.id = NEW.cover_asset_id;
    IF related_club_id IS DISTINCT FROM NEW.id OR related_purpose IS DISTINCT FROM 'CLUB_COVER' THEN
      RAISE EXCEPTION 'Cover asset must belong to the club and have cover purpose' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "milestones_club_immutable_trigger"
  BEFORE UPDATE OF "club_id" ON "milestones"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "posts_club_immutable_trigger"
  BEFORE UPDATE OF "club_id" ON "posts"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "comments_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "post_id", "parent_id", "required_milestone_id" ON "comments"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "predictions_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "post_id", "reveal_milestone_id" ON "predictions"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "notifications_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "club_id", "post_id", "comment_id", "required_milestone_id" ON "notifications"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "reports_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "club_id", "post_id", "comment_id", "target_type" ON "reports"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "file_assets_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "owner_id", "club_id", "post_id", "purpose" ON "file_assets"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "users_avatar_asset_invariant_trigger"
  BEFORE INSERT OR UPDATE OF "avatar_asset_id" ON "users"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
CREATE TRIGGER "clubs_cover_asset_invariant_trigger"
  BEFORE INSERT OR UPDATE OF "cover_asset_id" ON "clubs"
  FOR EACH ROW EXECUTE FUNCTION "enforce_loresafe_cross_record_invariants"();
