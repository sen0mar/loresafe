CREATE INDEX "posts_club_status_deleted_created_id_idx"
  ON "posts"("club_id", "status", "deleted_at", "created_at", "id");

CREATE INDEX "posts_club_author_status_deleted_created_id_idx"
  ON "posts"("club_id", "author_id", "status", "deleted_at", "created_at", "id");
