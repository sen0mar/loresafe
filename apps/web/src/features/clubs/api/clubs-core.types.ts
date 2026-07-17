export type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

export type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubCategory =
  | "BOOKS"
  | "TV_SHOWS"
  | "ANIME"
  | "MANGA"
  | "MOVIES"
  | "GAMES"
  | "PODCASTS"
  | "COURSES"
  | "COMICS_GRAPHIC_NOVELS"
  | "WEB_SERIALS"
  | "CUSTOM_TIMELINE";

export type ClubDiscoveryClub = {
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

export type Club = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverUrl: string | null;
  rules: string | null;
  visibility: ClubVisibility;
  memberCount: number;
  currentUserRole: ClubMembershipRole | null;
  membership: {
    isMember: boolean;
    role: ClubMembershipRole | null;
  };
  settings: {
    visibility: ClubVisibility;
    rules: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type ClubMember = {
  id: string;
  role: ClubMembershipRole;
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

export type ClubBan = {
  id: string;
  roleAtBan: ClubMembershipRole | null;
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

export type JoinedClub = {
  id: string;
  title: string;
  linkName: string;
  coverUrl: string | null;
  visibility: ClubVisibility;
  role: ClubMembershipRole;
  memberCount: number;
  joinedAt: string;
};

export type ClubsDiscoveryResponse = {
  clubs: ClubDiscoveryClub[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type PublicClubsQueryInput = {
  cursor?: string;
  limit?: number;
  sort?: "newest" | "popular";
};

export type ClubResponse = {
  club: Club;
};

export type LeaveClubResponse = {
  left: true;
  club: {
    id: string;
    linkName: string;
  };
};

export type ClubMembersResponse = {
  members: ClubMember[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type ClubMembersQueryInput = {
  page?: number;
  q?: string;
};

export type ClubBansResponse = {
  bans: ClubBan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type ClubMemberResponse = {
  member: ClubMember;
};

export type ClubBanResponse = {
  ban: ClubBan;
  deletedPostCount: number;
};

export type JoinedClubsResponse = {
  clubs: JoinedClub[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type ClubDashboardStatsResponse = {
  stats: {
    memberCount: number;
    milestoneCount: number;
    visiblePostCount: number;
    visibleCommentCount: number;
    postReactionCount: number;
    safePostCount: number;
    lockedPostCount: number;
    viewer: {
      joinedAt: string | null;
      postCount: number;
      commentCount: number;
    };
  };
};
export type CreateClubInput = {
  title: string;
  linkName: string;
  description?: string | null;
  category: ClubCategory;
  visibility: ClubVisibility;
  rules?: string | null;
};

export type UpdateClubMemberRoleInput = {
  role: ClubMembershipRole;
};

export type UpdateClubSettingsInput = {
  visibility: ClubVisibility;
  rules: string | null;
};

export type BanClubMemberInput = {
  reason?: string | null;
  expiresAt?: string;
  deleteAuthoredPosts?: boolean;
};

export type JoinedClubsQueryInput = {
  cursor?: string;
  q?: string;
  limit?: number;
};

export type JoinedClubsQueryOptions = JoinedClubsQueryInput & {
  enabled?: boolean;
};
