import type {
  ClubDetailRecord,
  ClubDiscoveryRecord
} from "./clubs.repository.js";

export type ClubVisibilityDto = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
export type ClubMembershipRoleDto = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubDiscoveryDto = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClubDto = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  rules: string | null;
  visibility: ClubVisibilityDto;
  memberCount: number;
  currentUserRole: ClubMembershipRoleDto | null;
  createdAt: string;
  updatedAt: string;
};

export type ClubsDiscoveryResponse = {
  clubs: ClubDiscoveryDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type ClubResponse = {
  club: ClubDto;
};

export const toClubDiscoveryDto = (
  club: ClubDiscoveryRecord
): ClubDiscoveryDto => ({
  id: club.id,
  title: club.title,
  slug: club.slug,
  description: club.description,
  category: club.category,
  visibility: club.visibility,
  memberCount: club.memberCount,
  createdAt: club.createdAt.toISOString(),
  updatedAt: club.updatedAt.toISOString()
});

export const toClubDto = (club: ClubDetailRecord): ClubDto => ({
  id: club.id,
  title: club.title,
  slug: club.slug,
  description: club.description,
  category: club.category,
  rules: club.rules,
  visibility: club.visibility,
  memberCount: club.memberCount,
  currentUserRole: club.currentUserRole,
  createdAt: club.createdAt.toISOString(),
  updatedAt: club.updatedAt.toISOString()
});
