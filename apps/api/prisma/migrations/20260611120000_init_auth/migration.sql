CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "display_name" VARCHAR(80) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "session_version" INTEGER NOT NULL DEFAULT 1,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_active_unique"
  ON "users"("email")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
