DROP TRIGGER IF EXISTS "milestones_club_immutable_trigger" ON "milestones";
DROP TRIGGER IF EXISTS "posts_club_immutable_trigger" ON "posts";
DROP TRIGGER IF EXISTS "comments_cross_record_invariants_trigger" ON "comments";
DROP TRIGGER IF EXISTS "predictions_cross_record_invariants_trigger" ON "predictions";
DROP TRIGGER IF EXISTS "notifications_cross_record_invariants_trigger" ON "notifications";
DROP TRIGGER IF EXISTS "reports_cross_record_invariants_trigger" ON "reports";
DROP TRIGGER IF EXISTS "file_assets_cross_record_invariants_trigger" ON "file_assets";
DROP TRIGGER IF EXISTS "users_avatar_asset_invariant_trigger" ON "users";
DROP TRIGGER IF EXISTS "clubs_cover_asset_invariant_trigger" ON "clubs";
DROP FUNCTION IF EXISTS "enforce_loresafe_cross_record_invariants"();

CREATE FUNCTION "enforce_immutable_club_id"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.club_id <> OLD.club_id THEN
    RAISE EXCEPTION '% cannot move between clubs', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_comment_invariants"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  post_club_id UUID;
BEGIN
  SELECT "club_id" INTO post_club_id FROM "posts" WHERE "id" = NEW."post_id";
  IF NOT EXISTS (
    SELECT 1 FROM "milestones"
    WHERE "id" = NEW."required_milestone_id" AND "club_id" = post_club_id
  ) THEN
    RAISE EXCEPTION 'Comment milestone must belong to the post club' USING ERRCODE = '23514';
  END IF;
  IF NEW."parent_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "comments"
    WHERE "id" = NEW."parent_id" AND "post_id" = NEW."post_id"
  ) THEN
    RAISE EXCEPTION 'Comment parent must belong to the same post' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_prediction_invariants"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  post_club_id UUID;
BEGIN
  SELECT "club_id" INTO post_club_id FROM "posts" WHERE "id" = NEW."post_id";
  IF NOT EXISTS (
    SELECT 1 FROM "milestones"
    WHERE "id" = NEW."reveal_milestone_id" AND "club_id" = post_club_id
  ) THEN
    RAISE EXCEPTION 'Prediction reveal milestone must belong to the post club' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_notification_invariants"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  comment_club_id UUID;
  comment_post_id UUID;
BEGIN
  IF NEW."comment_id" IS NOT NULL THEN
    SELECT p."club_id", c."post_id"
      INTO comment_club_id, comment_post_id
      FROM "comments" c
      JOIN "posts" p ON p."id" = c."post_id"
      WHERE c."id" = NEW."comment_id";
    IF comment_club_id IS DISTINCT FROM NEW."club_id"
      OR (NEW."post_id" IS NOT NULL AND comment_post_id IS DISTINCT FROM NEW."post_id") THEN
      RAISE EXCEPTION 'Notification targets must belong to the same club and post' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_report_invariants"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  comment_club_id UUID;
BEGIN
  IF NEW."comment_id" IS NOT NULL THEN
    SELECT p."club_id" INTO comment_club_id
      FROM "comments" c
      JOIN "posts" p ON p."id" = c."post_id"
      WHERE c."id" = NEW."comment_id";
    IF comment_club_id IS DISTINCT FROM NEW."club_id" THEN
      RAISE EXCEPTION 'Report target must belong to the report club' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_file_asset_invariants"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  post_author_id UUID;
BEGIN
  IF NEW."post_id" IS NOT NULL THEN
    SELECT "author_id" INTO post_author_id FROM "posts" WHERE "id" = NEW."post_id";
    IF post_author_id IS DISTINCT FROM NEW."owner_id" THEN
      RAISE EXCEPTION 'Post media owner must match the post author' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_user_avatar_invariant"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."avatar_asset_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "file_assets"
    WHERE "id" = NEW."avatar_asset_id"
      AND "owner_id" = NEW."id"
      AND "purpose" = 'AVATAR'
  ) THEN
    RAISE EXCEPTION 'Avatar asset must belong to the user and have avatar purpose' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "enforce_club_cover_invariant"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."cover_asset_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "file_assets"
    WHERE "id" = NEW."cover_asset_id"
      AND "club_id" = NEW."id"
      AND "purpose" = 'CLUB_COVER'
  ) THEN
    RAISE EXCEPTION 'Cover asset must belong to the club and have cover purpose' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "milestones_club_immutable_trigger"
  BEFORE UPDATE OF "club_id" ON "milestones"
  FOR EACH ROW EXECUTE FUNCTION "enforce_immutable_club_id"();
CREATE TRIGGER "posts_club_immutable_trigger"
  BEFORE UPDATE OF "club_id" ON "posts"
  FOR EACH ROW EXECUTE FUNCTION "enforce_immutable_club_id"();
CREATE TRIGGER "comments_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "post_id", "parent_id", "required_milestone_id" ON "comments"
  FOR EACH ROW EXECUTE FUNCTION "enforce_comment_invariants"();
CREATE TRIGGER "predictions_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "post_id", "reveal_milestone_id" ON "predictions"
  FOR EACH ROW EXECUTE FUNCTION "enforce_prediction_invariants"();
CREATE TRIGGER "notifications_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "club_id", "post_id", "comment_id", "required_milestone_id" ON "notifications"
  FOR EACH ROW EXECUTE FUNCTION "enforce_notification_invariants"();
CREATE TRIGGER "reports_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "club_id", "post_id", "comment_id", "target_type" ON "reports"
  FOR EACH ROW EXECUTE FUNCTION "enforce_report_invariants"();
CREATE TRIGGER "file_assets_cross_record_invariants_trigger"
  BEFORE INSERT OR UPDATE OF "owner_id", "club_id", "post_id", "purpose" ON "file_assets"
  FOR EACH ROW EXECUTE FUNCTION "enforce_file_asset_invariants"();
CREATE TRIGGER "users_avatar_asset_invariant_trigger"
  BEFORE INSERT OR UPDATE OF "avatar_asset_id" ON "users"
  FOR EACH ROW EXECUTE FUNCTION "enforce_user_avatar_invariant"();
CREATE TRIGGER "clubs_cover_asset_invariant_trigger"
  BEFORE INSERT OR UPDATE OF "cover_asset_id" ON "clubs"
  FOR EACH ROW EXECUTE FUNCTION "enforce_club_cover_invariant"();
