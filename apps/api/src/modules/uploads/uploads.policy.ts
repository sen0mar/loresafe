import type { ClubMembershipRole } from "./uploads.repository.js";

export const canUploadClubCover = (role: ClubMembershipRole | null) =>
  role === "OWNER" || role === "MODERATOR";

export const canUploadPostImage = (club: {
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
}) => club.currentUserRole !== null && !club.isCurrentUserBanned;
