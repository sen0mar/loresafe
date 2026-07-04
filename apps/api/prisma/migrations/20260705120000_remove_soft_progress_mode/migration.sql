ALTER TABLE "club_progress"
  ALTER COLUMN "mode" DROP DEFAULT;

CREATE TYPE "ProgressMode_new" AS ENUM ('STRICT', 'BRAVE', 'FINISHED');

ALTER TABLE "club_progress"
  ALTER COLUMN "mode" TYPE "ProgressMode_new"
  USING (
    CASE "mode"::text
      WHEN 'SOFT' THEN 'STRICT'
      ELSE "mode"::text
    END
  )::"ProgressMode_new";

ALTER TABLE "progress_history"
  ALTER COLUMN "from_mode" TYPE "ProgressMode_new"
  USING (
    CASE "from_mode"::text
      WHEN 'SOFT' THEN 'STRICT'
      ELSE "from_mode"::text
    END
  )::"ProgressMode_new";

ALTER TABLE "progress_history"
  ALTER COLUMN "to_mode" TYPE "ProgressMode_new"
  USING (
    CASE "to_mode"::text
      WHEN 'SOFT' THEN 'STRICT'
      ELSE "to_mode"::text
    END
  )::"ProgressMode_new";

DROP TYPE "ProgressMode";

ALTER TYPE "ProgressMode_new" RENAME TO "ProgressMode";

ALTER TABLE "club_progress"
  ALTER COLUMN "mode" SET DEFAULT 'STRICT';
