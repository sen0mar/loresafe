import type { ClubDetailRecord } from "./clubs.repository.types.js";
import type { ClubCategory } from "./clubs.schema.js";

type ClubDetailSource = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverAsset?: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null;
  rules: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  createdAt: Date;
  updatedAt: Date;
  memberships: Array<{ role: "OWNER" | "MODERATOR" | "MEMBER" }>;
  bans: Array<{ id: string }>;
  _count: { memberships: number };
};

export const toClubDetailRecord = (
  club: ClubDetailSource
): ClubDetailRecord => ({
  id: club.id,
  title: club.title,
  linkName: club.linkName,
  description: club.description,
  category: club.category,
  ...(Object.hasOwn(club, "coverAsset") ? { coverAsset: club.coverAsset } : {}),
  rules: club.rules,
  visibility: club.visibility,
  memberCount: club._count.memberships,
  currentUserRole: club.memberships[0]?.role ?? null,
  isCurrentUserBanned: club.bans.length > 0,
  createdAt: club.createdAt,
  updatedAt: club.updatedAt
});
