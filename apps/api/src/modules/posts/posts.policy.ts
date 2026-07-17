import { canDeleteClubContent } from "../clubs/club-content.policy.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

export const canViewClubFeed = (club: {
  visibility: ClubVisibility;
  currentUserRole: string | null;
  isCurrentUserBanned: boolean;
}) =>
  !club.isCurrentUserBanned &&
  (club.visibility === "PUBLIC" || club.currentUserRole !== null);

export const canCreateClubPost = (club: {
  currentUserRole: string | null;
  isCurrentUserBanned: boolean;
}) => club.currentUserRole !== null && !club.isCurrentUserBanned;

export const canDeletePost = ({
  authorId,
  currentUserId,
  currentUserRole
}: {
  authorId: string;
  currentUserId: string;
  currentUserRole: "OWNER" | "MODERATOR" | "MEMBER" | null;
}) => canDeleteClubContent({ authorId, currentUserId, currentUserRole });
