import type {
  ClubDetailRecord,
  ClubDiscoveryRecord
} from "./clubs.repository.js";
import { r2Storage } from "../../core/storage/r2-storage.js";

export type ClubVisibilityDto = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
export type ClubMembershipRoleDto = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubDiscoveryDto = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
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
  coverUrl: string | null;
  rules: string | null;
  visibility: ClubVisibilityDto;
  memberCount: number;
  currentUserRole: ClubMembershipRoleDto | null;
  membership: {
    isMember: boolean;
    role: ClubMembershipRoleDto | null;
  };
  settings: {
    visibility: ClubVisibilityDto;
    rules: string | null;
  };
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
  coverUrl: getReadyAssetUrl(club.coverAsset),
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
  coverUrl: getReadyAssetUrl(club.coverAsset),
  rules: club.rules,
  visibility: club.visibility,
  memberCount: club.memberCount,
  currentUserRole: club.currentUserRole,
  membership: {
    isMember: club.currentUserRole !== null,
    role: club.currentUserRole
  },
  settings: {
    visibility: club.visibility,
    rules: club.rules
  },
  createdAt: club.createdAt.toISOString(),
  updatedAt: club.updatedAt.toISOString()
});

const getReadyAssetUrl = (
  asset: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null | undefined
) => (asset?.status === "READY" ? r2Storage.getPublicUrl(asset.objectKey) : null);
