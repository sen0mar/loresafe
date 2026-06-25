import type { ClubMembershipRoleDto } from "../clubs/clubs.dto.js";

export const canReadClubProgress = (club: {
  currentUserRole: ClubMembershipRoleDto | null;
  isCurrentUserBanned: boolean;
}) => club.currentUserRole !== null && !club.isCurrentUserBanned;

export const canUpdateClubProgress = (club: {
  currentUserRole: ClubMembershipRoleDto | null;
  isCurrentUserBanned: boolean;
}) => club.currentUserRole !== null && !club.isCurrentUserBanned;
