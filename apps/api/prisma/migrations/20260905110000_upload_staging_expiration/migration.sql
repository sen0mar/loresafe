ALTER TABLE "file_assets" ADD COLUMN "upload_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "storage_object_deletions" ADD COLUMN "not_before" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
