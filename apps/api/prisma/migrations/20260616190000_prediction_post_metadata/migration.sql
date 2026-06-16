CREATE TYPE "PredictionStatus" AS ENUM (
  'UNRESOLVED',
  'CORRECT',
  'WRONG',
  'PARTIAL'
);

CREATE TABLE "predictions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "reveal_milestone_id" UUID NOT NULL,
  "status" "PredictionStatus" NOT NULL DEFAULT 'UNRESOLVED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "predictions_post_id_unique" ON "predictions"("post_id");
CREATE INDEX "predictions_post_id_idx" ON "predictions"("post_id");
CREATE INDEX "predictions_reveal_milestone_id_idx" ON "predictions"("reveal_milestone_id");

ALTER TABLE "predictions"
  ADD CONSTRAINT "predictions_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "predictions"
  ADD CONSTRAINT "predictions_reveal_milestone_id_fkey"
  FOREIGN KEY ("reveal_milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
