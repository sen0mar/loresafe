CREATE TYPE "ProgressMode" AS ENUM ('STRICT', 'SOFT', 'BRAVE', 'FINISHED');

CREATE TABLE "club_progress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "current_milestone_id" UUID,
  "mode" "ProgressMode" NOT NULL DEFAULT 'STRICT',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "club_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "from_milestone_id" UUID,
  "to_milestone_id" UUID,
  "from_mode" "ProgressMode" NOT NULL,
  "to_mode" "ProgressMode" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "progress_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "club_progress_user_id_club_id_unique"
  ON "club_progress"("user_id", "club_id");
CREATE INDEX "club_progress_user_id_idx" ON "club_progress"("user_id");
CREATE INDEX "club_progress_club_id_idx" ON "club_progress"("club_id");
CREATE INDEX "club_progress_current_milestone_id_idx"
  ON "club_progress"("current_milestone_id");

CREATE INDEX "progress_history_user_id_club_id_created_at_idx"
  ON "progress_history"("user_id", "club_id", "created_at");
CREATE INDEX "progress_history_club_id_created_at_idx"
  ON "progress_history"("club_id", "created_at");
CREATE INDEX "progress_history_from_milestone_id_idx"
  ON "progress_history"("from_milestone_id");
CREATE INDEX "progress_history_to_milestone_id_idx"
  ON "progress_history"("to_milestone_id");

ALTER TABLE "club_progress"
  ADD CONSTRAINT "club_progress_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_progress"
  ADD CONSTRAINT "club_progress_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_progress"
  ADD CONSTRAINT "club_progress_current_milestone_id_fkey"
  FOREIGN KEY ("current_milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_from_milestone_id_fkey"
  FOREIGN KEY ("from_milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "progress_history"
  ADD CONSTRAINT "progress_history_to_milestone_id_fkey"
  FOREIGN KEY ("to_milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
