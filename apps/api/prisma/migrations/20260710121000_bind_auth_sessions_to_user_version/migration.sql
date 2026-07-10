ALTER TABLE "auth_sessions"
  ADD COLUMN "session_version" INTEGER;

UPDATE "auth_sessions" AS session
SET "session_version" = "users"."session_version"
FROM "users"
WHERE "users"."id" = session."user_id";

ALTER TABLE "auth_sessions"
  ALTER COLUMN "session_version" SET NOT NULL;
