import type { ClubMembershipRoleDto } from "../clubs/clubs.dto.js";

export const canReadClubProgress = (role: ClubMembershipRoleDto | null) =>
  role !== null;

export const canUpdateClubProgress = (role: ClubMembershipRoleDto | null) =>
  role !== null;
