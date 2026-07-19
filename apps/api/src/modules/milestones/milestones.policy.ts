import type { ClubMembershipRoleDto } from "../clubs/clubs.dto.js";

export const canCreateClubMilestone = (role: ClubMembershipRoleDto | null) =>
  role === "OWNER" || role === "MODERATOR";
