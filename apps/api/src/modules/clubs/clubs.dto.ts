import type {
  ClubBanRecord,
  ClubDetailRecord,
  ClubDiscoveryRecord,
  ClubMemberRecord
} from "./clubs.repository.js";
import { r2Storage } from "../../core/storage/r2-storage.js";
import type { ClubCategory } from "./clubs.schema.js";

export type ClubVisibilityDto = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
export type ClubMembershipRoleDto = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubDiscoveryDto = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverUrl: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClubDto = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
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

export type ClubMemberDto = {
  id: string;
  role: ClubMembershipRoleDto;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  };
  activeBan: {
    id: string;
    reason: string | null;
    expiresAt: string | null;
    createdAt: string;
  } | null;
  joinedAt: string;
  updatedAt: string;
};

export type ClubBanDto = {
  id: string;
  roleAtBan: ClubMembershipRoleDto | null;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  };
  reason: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClubMembersResponse = {
  members: ClubMemberDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type ClubBansResponse = {
  bans: ClubBanDto[];
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

export type ClubMemberResponse = {
  member: ClubMemberDto;
};

export type ClubBanResponse = {
  ban: ClubBanDto;
  deletedPostCount: number;
};

export const toClubDiscoveryDto = (
  club: ClubDiscoveryRecord
): ClubDiscoveryDto => ({
  id: club.id,
  title: club.title,
  linkName: club.linkName,
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
  linkName: club.linkName,
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

export const toClubMemberDto = (member: ClubMemberRecord): ClubMemberDto => ({
  id: member.id,
  role: member.role,
  user: {
    id: member.user.id,
    displayName: member.user.displayName,
    username: member.user.username,
    avatarUrl: getReadyAssetUrl(member.user.avatarAsset)
  },
  activeBan: member.activeBan
    ? {
        id: member.activeBan.id,
        reason: member.activeBan.reason,
        expiresAt: member.activeBan.expiresAt?.toISOString() ?? null,
        createdAt: member.activeBan.createdAt.toISOString()
      }
    : null,
  joinedAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString()
});

export const toClubBanDto = (ban: ClubBanRecord): ClubBanDto => ({
  id: ban.id,
  roleAtBan: ban.roleAtBan,
  user: {
    id: ban.user.id,
    displayName: ban.user.displayName,
    username: ban.user.username,
    avatarUrl: getReadyAssetUrl(ban.user.avatarAsset)
  },
  reason: ban.reason,
  expiresAt: ban.expiresAt?.toISOString() ?? null,
  revokedAt: ban.revokedAt?.toISOString() ?? null,
  createdAt: ban.createdAt.toISOString(),
  updatedAt: ban.updatedAt.toISOString()
});

const getReadyAssetUrl = (
  asset: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null | undefined
) => (asset?.status === "READY" ? r2Storage.getPublicUrl(asset.objectKey) : null);
