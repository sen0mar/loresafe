CREATE UNIQUE INDEX "users_display_name_active_unique"
  ON "users"("display_name")
  WHERE "deleted_at" IS NULL;
