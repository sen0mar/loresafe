CREATE INDEX "clubs_visibility_created_at_id_idx"
  ON "clubs"("visibility", "created_at", "id");

CREATE INDEX "club_memberships_user_created_id_idx"
  ON "club_memberships"("user_id", "created_at", "id");

CREATE INDEX "club_memberships_club_role_created_id_idx"
  ON "club_memberships"("club_id", "role", "created_at", "id");

CREATE INDEX "comments_post_status_deleted_created_id_idx"
  ON "comments"("post_id", "status", "deleted_at", "created_at", "id");

CREATE INDEX "notifications_user_id_created_at_id_idx"
  ON "notifications"("user_id", "created_at", "id");

CREATE INDEX "reports_club_status_created_id_idx"
  ON "reports"("club_id", "status", "created_at", "id");
