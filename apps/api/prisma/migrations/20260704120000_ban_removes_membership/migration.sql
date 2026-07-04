ALTER TABLE "club_bans"
  ADD COLUMN "role_at_ban" "ClubMembershipRole";

UPDATE "club_bans" AS ban
SET "role_at_ban" = membership."role"
FROM "club_memberships" AS membership
WHERE ban."club_id" = membership."club_id"
  AND ban."user_id" = membership."user_id"
  AND ban."role_at_ban" IS NULL;

DELETE FROM "club_memberships" AS membership
USING "club_bans" AS ban
WHERE ban."club_id" = membership."club_id"
  AND ban."user_id" = membership."user_id"
  AND ban."revoked_at" IS NULL
  AND (ban."expires_at" IS NULL OR ban."expires_at" > CURRENT_TIMESTAMP);
