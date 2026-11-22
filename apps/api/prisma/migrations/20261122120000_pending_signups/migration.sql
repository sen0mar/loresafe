-- Signups wait here until the email link is confirmed; the account and its
-- username reservations are created only on confirmation.
CREATE TABLE "pending_signups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "username" VARCHAR(30) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pending_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_signups_email_unique"
ON "pending_signups"("email");

CREATE UNIQUE INDEX "pending_signups_token_hash_unique"
ON "pending_signups"("token_hash");

CREATE INDEX "pending_signups_expires_at_idx"
ON "pending_signups"("expires_at");

-- Approved one-time cleanup. Accounts that predate verification, plus demo and
-- showcase seeds, were stored as verified. The only unverified active accounts
-- are signups that never received a link and could never log in, so they hold
-- no content; remove them to free their emails and usernames.
DELETE FROM "users" AS u
WHERE u."email_verified_at" IS NULL
  AND u."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "auth_sessions" AS s WHERE s."user_id" = u."id"
  );

-- Verification now lives on pending signups; old account-bound links are dead.
DELETE FROM "email_identity_tokens"
WHERE "purpose" = 'VERIFY_EMAIL';
