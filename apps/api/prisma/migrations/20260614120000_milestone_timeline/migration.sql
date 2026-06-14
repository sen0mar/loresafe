CREATE TABLE "milestones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "safe_title" VARCHAR(120) NOT NULL,
  "full_title" VARCHAR(160),
  "description" VARCHAR(500),
  "spoiler_name" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "milestones_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "milestones_position_positive_check" CHECK ("position" > 0)
);

CREATE UNIQUE INDEX "milestones_club_id_position_unique"
  ON "milestones"("club_id", "position");

CREATE INDEX "milestones_club_id_idx"
  ON "milestones"("club_id");
