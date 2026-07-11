import type { TimestampUuidCursor } from "../../core/http/cursor.js";
import type {
  BanClubMemberRequest,
  ClubCategory,
  CreateClubRequest,
  ListClubBansQuery,
  ListClubMembersQuery,
  ListClubsQuery,
  ListPublicSeoClubsQuery,
  UpdateClubSettingsRequest
} from "./clubs.schema.js";

export type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
export type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";
type AssetRecord =
  | { objectKey: string; status: "PENDING" | "READY" | "FAILED" }
  | null
  | undefined;

export type ClubDiscoveryRecord = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverAsset?: AssetRecord;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicClubDetailRecord = ClubDiscoveryRecord & {
  rules: string | null;
};
export type PublicClubSitemapEntryRecord = {
  linkName: string;
  updatedAt: Date;
};

export type ClubDetailRecord = Omit<ClubDiscoveryRecord, "visibility"> & {
  rules: string | null;
  visibility: ClubVisibility;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
};

export type ListPublicClubsResult = {
  clubs: ClubDiscoveryRecord[];
  hasMore: boolean;
  nextCursor: TimestampUuidCursor | null;
};
export type ListPublicClubsInput = {
  cursor: TimestampUuidCursor | null;
  limit: number;
  sort: ListClubsQuery["sort"] | ListPublicSeoClubsQuery["sort"];
};
export type ListPublicClubSitemapEntriesResult = {
  entries: PublicClubSitemapEntryRecord[];
};

export type ClubMemberRecord = {
  id: string;
  role: ClubMembershipRole;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarAsset?: AssetRecord;
  };
  activeBan: {
    id: string;
    reason: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClubBanRecord = {
  id: string;
  roleAtBan: ClubMembershipRole | null;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarAsset?: AssetRecord;
  };
  reason: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClubAccessRecord = {
  id: string;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
} | null;
export type ListClubMembersResult = {
  club: ClubAccessRecord;
  members: ClubMemberRecord[];
  total: number;
};
export type ListClubBansResult = {
  club: ClubAccessRecord;
  bans: ClubBanRecord[];
  total: number;
};

export type ClubMemberMutationResult =
  | { status: "SUCCESS"; member: ClubMemberRecord }
  | {
      status:
        | "ACTOR_BANNED"
        | "ACTOR_NOT_ALLOWED"
        | "CLUB_NOT_FOUND"
        | "LAST_OWNER"
        | "MEMBER_NOT_FOUND";
    };
export type ClubBanMutationResult =
  | { status: "SUCCESS"; ban: ClubBanRecord; deletedPostCount: number }
  | {
      status:
        | "ACTOR_BANNED"
        | "ACTOR_NOT_ALLOWED"
        | "BAN_NOT_FOUND"
        | "CLUB_NOT_FOUND"
        | "LAST_OWNER"
        | "MEMBER_NOT_FOUND";
    };
export type ClubSettingsMutationResult =
  | { status: "SUCCESS"; club: ClubDetailRecord }
  | { status: "ACTOR_BANNED" | "ACTOR_NOT_ALLOWED" | "CLUB_NOT_FOUND" };
export type LeaveClubResult =
  | { status: "SUCCESS"; club: { id: string; linkName: string } }
  | {
      status:
        "ACTOR_BANNED" | "CLUB_NOT_FOUND" | "LAST_OWNER" | "MEMBER_NOT_FOUND";
    };
export type JoinPublicClubResult =
  | { status: "SUCCESS"; club: ClubDetailRecord }
  | { status: "BANNED" | "NOT_FOUND" };

export type ClubsRepository = {
  createClubWithOwnerMembership: (
    userId: string,
    input: CreateClubRequest
  ) => Promise<ClubDetailRecord>;
  findClubByLinkName: (linkName: string) => Promise<{ id: string } | null>;
  findVisibleClubByLinkNameForUser: (
    linkName: string,
    userId: string
  ) => Promise<ClubDetailRecord | null>;
  joinPublicClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<JoinPublicClubResult>;
  leaveClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<LeaveClubResult>;
  updateClubSettings: (
    linkName: string,
    actorId: string,
    input: UpdateClubSettingsRequest
  ) => Promise<ClubSettingsMutationResult>;
  listClubMembersByLinkName: (
    linkName: string,
    userId: string,
    input: ListClubMembersQuery
  ) => Promise<ListClubMembersResult>;
  listClubBansByLinkName: (
    linkName: string,
    userId: string,
    input: ListClubBansQuery
  ) => Promise<ListClubBansResult>;
  updateClubMemberRole: (
    linkName: string,
    membershipId: string,
    actorId: string,
    role: ClubMembershipRole
  ) => Promise<ClubMemberMutationResult>;
  banClubMember: (
    linkName: string,
    membershipId: string,
    actorId: string,
    input: BanClubMemberRequest
  ) => Promise<ClubBanMutationResult>;
  unbanClubBan: (
    linkName: string,
    banId: string,
    actorId: string
  ) => Promise<ClubBanMutationResult>;
  listPublicClubs: (
    userId: string,
    input: ListPublicClubsInput
  ) => Promise<ListPublicClubsResult>;
  listPublicSeoClubs: (
    currentUserId: string | null,
    input: ListPublicClubsInput
  ) => Promise<ListPublicClubsResult>;
  findPublicSeoClubByLinkName: (
    linkName: string,
    currentUserId: string | null
  ) => Promise<PublicClubDetailRecord | null>;
  listPublicClubSitemapEntries: (
    limit: number
  ) => Promise<ListPublicClubSitemapEntriesResult>;
};
