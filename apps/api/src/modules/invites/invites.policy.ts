import type { ClubMembershipRoleDto } from "../clubs/clubs.dto.js";

export const canCreateClubInvite = (role: ClubMembershipRoleDto | null) =>
  role === "OWNER" || role === "MODERATOR";
