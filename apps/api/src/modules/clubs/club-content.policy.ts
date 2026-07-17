type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export const canDeleteClubContent = ({
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
