type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

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
  currentUserRole: ClubMembershipRole | null;
}) =>
  authorId === currentUserId ||
  currentUserRole === "OWNER" ||
  currentUserRole === "MODERATOR";
