-- Normalize existing profile names before enforcing locked usernames.
UPDATE "users"
SET "display_name" = btrim("display_name")
WHERE "display_name" <> btrim("display_name");

WITH normalized_usernames AS (
  SELECT
    "id",
    COALESCE(
      NULLIF(
        btrim(
          regexp_replace(
            lower(btrim(COALESCE("username", "display_name"))),
            '[^a-z0-9_]+',
            '_',
            'g'
          ),
          '_'
        ),
        ''
      ),
      'user'
    ) AS "base_username",
    "created_at"
  FROM "users"
),
numbered_usernames AS (
  SELECT
    "id",
    CASE
      WHEN length("base_username") >= 3 THEN left("base_username", 30)
      ELSE 'user_' || "base_username"
    END AS "base_username",
    row_number() OVER (
      PARTITION BY CASE
        WHEN length("base_username") >= 3 THEN left("base_username", 30)
        ELSE 'user_' || "base_username"
      END
      ORDER BY "created_at", "id"
    ) AS "username_position"
  FROM normalized_usernames
),
resolved_usernames AS (
  SELECT
    "id",
    CASE
      WHEN "username_position" = 1 THEN "base_username"
      ELSE
        left(
          "base_username",
          30 - length('_' || "username_position"::text)
        ) || '_' || "username_position"::text
    END AS "next_username"
  FROM numbered_usernames
)
UPDATE "users"
SET "username" = resolved_usernames."next_username"
FROM resolved_usernames
WHERE "users"."id" = resolved_usernames."id"
  AND (
    "users"."username" IS NULL
    OR "users"."username" !~ '^[a-z0-9_]{3,30}$'
    OR "users"."username" IS DISTINCT FROM resolved_usernames."next_username"
  );

DROP INDEX IF EXISTS "users_display_name_active_unique";
DROP INDEX IF EXISTS "users_username_active_unique";

ALTER TABLE "users"
  ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "users_username_active_unique"
  ON "users"("username")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "users_display_name_active_ci_unique"
  ON "users"(lower(btrim("display_name")))
  WHERE "deleted_at" IS NULL;

CREATE TABLE "user_name_reservations" (
  "normalized_name" VARCHAR(80) PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX "user_name_reservations_user_id_idx"
  ON "user_name_reservations"("user_id");

INSERT INTO "user_name_reservations" ("normalized_name", "user_id")
SELECT lower(btrim("username")), "id"
FROM "users"
WHERE "deleted_at" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users" "u"
    JOIN "user_name_reservations" "r"
      ON "r"."normalized_name" = lower(btrim("u"."display_name"))
     AND "r"."user_id" <> "u"."id"
    WHERE "u"."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot create user_name_reservations because active display names conflict with another user reservation';
  END IF;
END $$;

INSERT INTO "user_name_reservations" ("normalized_name", "user_id")
SELECT lower(btrim("display_name")), "id"
FROM "users"
WHERE "deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "user_name_reservations"
    WHERE "user_name_reservations"."normalized_name" = lower(btrim("users"."display_name"))
  );
