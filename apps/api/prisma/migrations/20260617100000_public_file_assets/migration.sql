CREATE TYPE "FileAssetPurpose" AS ENUM (
  'AVATAR',
  'CLUB_COVER'
);

CREATE TYPE "FileAssetVisibility" AS ENUM (
  'PUBLIC'
);

CREATE TYPE "FileAssetStatus" AS ENUM (
  'PENDING',
  'READY',
  'FAILED'
);

CREATE TABLE "file_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "club_id" UUID,
  "purpose" "FileAssetPurpose" NOT NULL,
  "visibility" "FileAssetVisibility" NOT NULL DEFAULT 'PUBLIC',
  "object_key" VARCHAR(512) NOT NULL,
  "content_type" VARCHAR(120) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
  "ready_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "file_assets_object_key_not_empty_check" CHECK (length(btrim("object_key")) > 0),
  CONSTRAINT "file_assets_content_type_not_empty_check" CHECK (length(btrim("content_type")) > 0),
  CONSTRAINT "file_assets_size_bytes_positive_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "file_assets_avatar_has_no_club_check" CHECK ("purpose" <> 'AVATAR' OR "club_id" IS NULL),
  CONSTRAINT "file_assets_club_cover_has_club_check" CHECK ("purpose" <> 'CLUB_COVER' OR "club_id" IS NOT NULL),
  CONSTRAINT "file_assets_ready_has_ready_at_check" CHECK ("status" <> 'READY' OR "ready_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "file_assets_object_key_unique"
  ON "file_assets"("object_key");
CREATE INDEX "file_assets_owner_purpose_status_created_at_idx"
  ON "file_assets"("owner_id", "purpose", "status", "created_at");
CREATE INDEX "file_assets_club_purpose_status_created_at_idx"
  ON "file_assets"("club_id", "purpose", "status", "created_at");
CREATE INDEX "file_assets_status_created_at_idx"
  ON "file_assets"("status", "created_at");

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD COLUMN "avatar_asset_id" UUID;

CREATE UNIQUE INDEX "users_avatar_asset_id_unique"
  ON "users"("avatar_asset_id")
  WHERE "avatar_asset_id" IS NOT NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_avatar_asset_id_fkey"
  FOREIGN KEY ("avatar_asset_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clubs"
  ADD COLUMN "cover_asset_id" UUID;

CREATE UNIQUE INDEX "clubs_cover_asset_id_unique"
  ON "clubs"("cover_asset_id")
  WHERE "cover_asset_id" IS NOT NULL;

ALTER TABLE "clubs"
  ADD CONSTRAINT "clubs_cover_asset_id_fkey"
  FOREIGN KEY ("cover_asset_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
