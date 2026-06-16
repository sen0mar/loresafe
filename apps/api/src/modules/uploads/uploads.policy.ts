import type { ClubMembershipRole } from "./uploads.repository.js";

export const canUploadClubCover = (role: ClubMembershipRole | null) =>
  role === "OWNER" || role === "MODERATOR";
