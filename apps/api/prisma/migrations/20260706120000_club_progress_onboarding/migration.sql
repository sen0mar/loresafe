ALTER TABLE "club_progress"
ADD COLUMN "onboarding_completed_at" TIMESTAMPTZ(6);

UPDATE "club_progress"
SET "onboarding_completed_at" = "updated_at"
WHERE "onboarding_completed_at" IS NULL;
