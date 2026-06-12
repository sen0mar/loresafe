ALTER TABLE "users"
  ADD COLUMN "handle" VARCHAR(30),
  ADD COLUMN "bio" VARCHAR(160);

CREATE UNIQUE INDEX "users_handle_active_unique"
  ON "users"("handle")
  WHERE "deleted_at" IS NULL AND "handle" IS NOT NULL;
