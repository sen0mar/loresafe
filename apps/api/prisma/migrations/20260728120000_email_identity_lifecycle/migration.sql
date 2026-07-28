CREATE TYPE "EmailIdentityTokenPurpose" AS ENUM (
  'VERIFY_EMAIL',
  'RESET_PASSWORD'
);

ALTER TABLE "users"
ADD COLUMN "email_verified_at" TIMESTAMPTZ(6);

-- Existing accounts predate verification links and retain their current access.
UPDATE "users"
SET "email_verified_at" = COALESCE("created_at", CURRENT_TIMESTAMP)
WHERE "deleted_at" IS NULL;

CREATE TABLE "email_identity_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "purpose" "EmailIdentityTokenPurpose" NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_identity_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_identity_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "email_identity_tokens_hash_unique"
ON "email_identity_tokens"("token_hash");

CREATE INDEX "email_identity_tokens_user_purpose_active_idx"
ON "email_identity_tokens"("user_id", "purpose", "consumed_at", "expires_at");

CREATE INDEX "email_identity_tokens_expires_at_idx"
ON "email_identity_tokens"("expires_at");
