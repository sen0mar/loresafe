type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

export const canViewClubFeed = (club: {
  visibility: ClubVisibility;
  currentUserRole: string | null;
}) => club.visibility === "PUBLIC" || club.currentUserRole !== null;
