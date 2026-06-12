DROP INDEX "users_handle_active_unique";

ALTER TABLE "users"
  RENAME COLUMN "handle" TO "username";

CREATE UNIQUE INDEX "users_username_active_unique"
  ON "users"("username")
  WHERE "deleted_at" IS NULL AND "username" IS NOT NULL;
