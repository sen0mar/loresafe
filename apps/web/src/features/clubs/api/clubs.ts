import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/shared/api/api-client";

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

export type ProgressMode = "STRICT" | "BRAVE" | "FINISHED";

export type PostType =
  | "DISCUSSION"
  | "QUESTION"
  | "THEORY"
  | "PREDICTION"
  | "POLL"
  | "REACTION"
  | "REVIEW"
  | "IMAGE_MEME"
  | "QUOTE_COMMENTARY"
  | "JUST_REACHED";

export type PostStatus = "VISIBLE" | "HIDDEN";

export type PredictionStatus =
  | "UNRESOLVED"
  | "CORRECT"
  | "WRONG"
  | "PARTIAL";

export type PostReactionEmoji = "👍" | "❤️" | "😂" | "😮" | "👀";
export type CommentReactionEmoji = PostReactionEmoji;

export type ReportTargetType = "POST" | "COMMENT";

export type ReportReason =
  | "SPOILER"
  | "HARASSMENT"
  | "HATE"
  | "SPAM"
  | "OFF_TOPIC"
  | "OTHER";

export const postReactionEmojis: PostReactionEmoji[] = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "👀"
];
export const commentReactionEmojis = postReactionEmojis;

export type ClubFeedTab =
  | "safe"
  | "unanswered"
  | "locked"
  | "all"
  | "my-posts";

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

export type ClubMilestone = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  description: string | null;
  spoilerName: boolean;
  isFullTitleHidden: boolean;
};

export type ClubProgressMilestone = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  isFullTitleHidden: boolean;
};

export type ClubProgressHistory = {
  id: string;
  fromMode: ProgressMode;
  toMode: ProgressMode;
  fromMilestone: ClubProgressMilestone | null;
  toMilestone: ClubProgressMilestone | null;
  createdAt: string;
};

export type ClubProgress = {
  id: string | null;
  mode: ProgressMode;
  currentMilestone: ClubProgressMilestone | null;
  totalMilestones: number;
  completedMilestones: number;
  percentage: number;
  onboardingCompletedAt: string | null;
  needsWelcomeSetup: boolean;
  updatedAt: string | null;
  history: ClubProgressHistory[];
};

export type ClubPostCounts = {
  commentCount: number;
  reactionCount: number;
  unreadCommentCount: number;
  reactions: Array<{
    emoji: PostReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
};

export type CommentReactionCounts = {
  reactionCount: number;
  reactions: Array<{
    emoji: CommentReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
};

export type ContentPermissions = {
  canDelete: boolean;
};

export type ClubPostRequiredMilestone = {
  id: string;
  position: number;
  label: string;
};

export type ClubPostPrediction = {
  status: PredictionStatus;
  revealMilestone: ClubPostRequiredMilestone;
};

export type ClubPostMedia = {
  id: string;
  contentType: string;
  sizeBytes: number;
  safePreview: boolean;
  url: string;
  urlExpiresAt: string;
};

export type VisibleClubPostCard = {
  id: string;
  visibility: "VISIBLE";
  type: PostType;
  status: PostStatus;
  title: string;
  bodyPreview: string;
  author: {
    id: string;
    displayName: string;
    username: string | null;
  };
  requiredMilestone: ClubPostRequiredMilestone;
  prediction?: ClubPostPrediction;
  media?: ClubPostMedia;
  permissions: ContentPermissions;
  counts: ClubPostCounts;
  createdAt: string;
  updatedAt: string;
};

export type LockedClubPostCard = {
  id: string;
  visibility: "LOCKED";
  type: PostType;
  status: PostStatus;
  requiredMilestone: ClubPostRequiredMilestone;
  counts: ClubPostCounts;
  permissions: ContentPermissions;
  lockReason: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubPostCard = VisibleClubPostCard | LockedClubPostCard;

export type RevealedClubPost = Omit<
  VisibleClubPostCard,
  "bodyPreview" | "visibility"
> & {
  visibility: "REVEALED";
  body: string;
};

export type VisibleComment = {
  id: string;
  visibility: "VISIBLE";
  status: PostStatus;
  body: string;
  author: {
    id: string;
    displayName: string;
    username: string | null;
  };
  parentId: string | null;
  requiredMilestone: ClubPostRequiredMilestone;
  counts: CommentReactionCounts;
  permissions: ContentPermissions;
  createdAt: string;
  updatedAt: string;
};

export type LockedComment = {
  id: string;
  visibility: "LOCKED";
  status: PostStatus;
  parentId: string | null;
  requiredMilestone: ClubPostRequiredMilestone;
  counts: CommentReactionCounts;
  permissions: ContentPermissions;
  lockReason: string;
  createdAt: string;
  updatedAt: string;
};

export type Comment = VisibleComment | LockedComment;

export type RevealedComment = Omit<VisibleComment, "visibility"> & {
  visibility: "REVEALED";
};

export type ClubsDiscoveryResponse = {
  clubs: ClubDiscoveryClub[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type PublicClubsQueryInput = {
  limit?: number;
  page?: number;
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
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type ClubMilestonesResponse = {
  milestones: ClubMilestone[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type ClubProgressResponse = {
  progress: ClubProgress;
};

export type ClubPostsResponse = {
  posts: ClubPostCard[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type CreateClubPostInput = {
  title: string;
  body: string;
  type: PostType;
  requiredMilestoneId: string;
  mediaAssetId?: string;
  prediction?: {
    revealMilestoneId: string;
  };
};

export type RecentlyUnlockedResponse = {
  unlock: {
    historyId: string | null;
    fromPosition: number;
    toPosition: number;
    unlockedAt: string | null;
  };
  posts: ClubPostCard[];
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

export type ProgressSummaryResponse = {
  progress: {
    mode: ProgressMode;
    currentMilestone: ClubPostRequiredMilestone | null;
    totalMilestones: number;
    completedMilestones: number;
    percentage: number;
    updatedAt: string | null;
  };
};

export type PopularDiscussionsResponse = {
  discussions: Array<{
    post: ClubPostCard;
    engagementScore: number;
  }>;
  pagination: {
    limit: number;
  };
};

export type RecentlyUnlockedSummaryResponse = {
  unlock: {
    historyId: string | null;
    fromPosition: number;
    toPosition: number;
    unlockedAt: string | null;
  };
  posts: ClubPostCard[];
  pagination: {
    limit: number;
  };
};

export type CreateClubPostResponse = {
  post: ClubPostCard;
};

export type PostDetailResponse = {
  post: ClubPostCard;
  club: {
    id: string;
    linkName: string;
  };
};

export type RevealPostResponse = {
  post: RevealedClubPost;
  club: {
    id: string;
    linkName: string;
  };
};

export type TogglePostReactionInput = {
  emoji: PostReactionEmoji;
};

export type TogglePostReactionResponse = {
  post: ClubPostCard;
};

export type DeletePostResponse = {
  post: {
    id: string;
    deletedAt: string;
  };
};

export type ToggleCommentReactionInput = {
  emoji: CommentReactionEmoji;
};

export type ToggleCommentReactionResponse = {
  comment: Comment;
};

export type DeleteCommentResponse = {
  comment: {
    id: string;
    postId: string;
    deletedAt: string;
  };
};

export type PostCommentsResponse = {
  comments: Comment[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type CreatePostCommentInput = {
  body: string;
  parentId?: string;
  requiredMilestoneId?: string;
};

export type CreatePostCommentResponse = {
  comment: Comment;
};

export type CreateReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

export type Report = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  updatedAt: string;
};

export type ModerationReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export type ModerationReportUser = {
  id: string;
  displayName: string;
  username: string | null;
};

export type ModerationReportTargetMetadata = {
  id: string;
  targetType: ReportTargetType;
  visibility: "HIDDEN";
  status: "VISIBLE" | "HIDDEN" | "DELETED" | "UNAVAILABLE";
  author: ModerationReportUser | null;
  requiredMilestone: ClubPostRequiredMilestone | null;
  contentHidden: true;
};

export type RevealedModerationReportTarget =
  | (Omit<
      ModerationReportTargetMetadata,
      "visibility" | "contentHidden" | "targetType"
    > & {
      targetType: "POST";
      visibility: "REVEALED";
      title: string;
      body: string;
    })
  | (Omit<
      ModerationReportTargetMetadata,
      "visibility" | "contentHidden" | "targetType"
    > & {
      targetType: "COMMENT";
      visibility: "REVEALED";
      body: string;
    });

export type ModerationReport = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: ModerationReportStatus;
  reporter: ModerationReportUser;
  detailsHidden: boolean;
  target: ModerationReportTargetMetadata;
  createdAt: string;
  updatedAt: string;
};

export type RevealedModerationReport = Omit<
  ModerationReport,
  "detailsHidden" | "target"
> & {
  details: string | null;
  target: RevealedModerationReportTarget;
};

export type CreateReportResponse = {
  report: Report;
};

export type ModerationReportsResponse = {
  reports: ModerationReport[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type RevealModerationReportResponse = {
  report: RevealedModerationReport;
};

export type ModerationReportActionResponse = {
  report: ModerationReport;
  deletedPostCount?: number;
};

export type ModerationReportNoteInput = {
  moderatorNote?: string;
};

export type UpdateReportRequiredMilestoneInput =
  ModerationReportNoteInput & {
    requiredMilestoneId: string;
  };

export type BanReportedContentAuthorInput = ModerationReportNoteInput & {
  expiresAt?: string;
  deleteAuthoredPosts?: boolean;
};

export type ResolveModerationReportInput = ModerationReportNoteInput & {
  status: "RESOLVED" | "DISMISSED";
};

export type RevealCommentResponse = {
  comment: RevealedComment;
};

export type CreateClubMilestoneInput = {
  safeTitle: string;
  fullTitle?: string | null;
  description?: string | null;
  spoilerName: boolean;
};

export type CreateClubMilestoneResponse = {
  milestone: ClubMilestone;
};

export type UpdateClubMilestoneInput = CreateClubMilestoneInput;

export type UpdateClubMilestoneResponse = {
  milestone: ClubMilestone;
};

export type MoveClubMilestoneInput = {
  milestoneId: string;
  direction: "UP" | "DOWN";
};

export type MoveClubMilestoneResponse = {
  milestones: ClubMilestone[];
};

export type MilestoneTemplate =
  | "BOOK"
  | "SHOW"
  | "MOVIE"
  | "GAME"
  | "PODCAST_COURSE"
  | "CUSTOM";

export type CreateClubMilestoneTemplateInput = {
  template: MilestoneTemplate;
  count: number;
  safeTitles?: string[];
};

export type CreateClubMilestoneTemplateResponse = {
  milestones: ClubMilestone[];
};

export type CreateClubInput = {
  title: string;
  linkName: string;
  description?: string | null;
  category: ClubCategory;
  visibility: ClubVisibility;
  rules?: string | null;
};

export type UpdateClubProgressInput = {
  currentMilestoneId: string | null;
  mode: ProgressMode;
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
  q?: string;
  page?: number;
  limit?: number;
};

type JoinedClubsQueryOptions = JoinedClubsQueryInput & {
  enabled?: boolean;
};

export const refreshClubAssetQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discoveryRoot
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
};

export const refreshClubMemberManagementQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.membersRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.bansRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(linkName)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("comments")
  });
};

export const refreshClubSettingsQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discoveryRoot
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(linkName)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("search")
  });
};

const reconcileModerationReportMutation = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string,
  report: ModerationReport
) => {
  queryClient.setQueryData<InfiniteData<ModerationReportsResponse>>(
    clubsQueryKeys.moderationReports(linkName),
    (currentResponse) => {
      if (!currentResponse) {
        return currentResponse;
      }

      return {
        ...currentResponse,
        pages: currentResponse.pages.map((page) => ({
          ...page,
          reports:
            report.status === "OPEN"
              ? page.reports.map((currentReport) =>
                  currentReport.id === report.id ? report : currentReport
                )
              : page.reports.filter(
                  (currentReport) => currentReport.id !== report.id
                )
        }))
      };
    }
  );
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.moderationReports(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.postDetail(report.target.id)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("comments")
  });
};

export const clubsQueryKeys = {
  discoveryRoot: ["clubs", "discovery"] as const,
  discovery: (input: PublicClubsQueryInput = {}) =>
    [
      "clubs",
      "discovery",
      {
        limit: input.limit ?? 20,
        page: input.page ?? 1,
        sort: input.sort ?? "newest"
      }
    ] as const,
  joined: ["users", "me", "clubs"] as const,
  joinedList: ({ limit, page, q }: JoinedClubsQueryInput) =>
    ["users", "me", "clubs", { limit, page, q: q?.trim() ?? "" }] as const,
  detail: (linkName: string) => ["clubs", "detail", linkName] as const,
  milestonesRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "milestones"] as const,
  milestones: (linkName: string, page: number) =>
    ["clubs", "detail", linkName, "milestones", page] as const,
  progress: (linkName: string) => ["clubs", "detail", linkName, "progress"] as const,
  membersRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "members"] as const,
  members: (linkName: string, { page = 1, q = "" }: ClubMembersQueryInput) =>
    ["clubs", "detail", linkName, "members", { page, q: q.trim() }] as const,
  bansRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "bans"] as const,
  bans: (linkName: string, page: number) =>
    ["clubs", "detail", linkName, "bans", page] as const,
  feedRoot: (linkName: string) => ["clubs", "detail", linkName, "feed"] as const,
  feed: (linkName: string, tab: ClubFeedTab) =>
    ["clubs", "detail", linkName, "feed", tab] as const,
  dashboardRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard"] as const,
  dashboardStats: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard", "stats"] as const,
  dashboardProgressSummary: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard", "progress-summary"] as const,
  dashboardPopularDiscussions: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard", "popular-discussions"] as const,
  dashboardRecentlyUnlockedSummary: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard", "recently-unlocked-summary"] as const,
  recentlyUnlocked: (linkName: string) =>
    ["clubs", "detail", linkName, "recently-unlocked"] as const,
  moderationReports: (linkName: string) =>
    ["clubs", "detail", linkName, "moderation", "reports"] as const,
  postsRoot: ["posts"] as const,
  postDetail: (postId: string) => ["posts", "detail", postId] as const,
  postComments: (postId: string) =>
    ["posts", "detail", postId, "comments"] as const
};

export const getPublicClubs = (input: PublicClubsQueryInput = {}) => {
  const params = new URLSearchParams();

  if (input.page) {
    params.set("page", String(input.page));
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.sort) {
    params.set("sort", input.sort);
  }

  const query = params.toString();

  return apiGet<ClubsDiscoveryResponse>(query ? `/api/clubs?${query}` : "/api/clubs");
};

export const getClubByLinkName = (linkName: string) =>
  apiGet<ClubResponse>(`/api/clubs/${linkName}`);

export const getClubMembers = (
  linkName: string,
  { page = 1, q = "" }: ClubMembersQueryInput = {}
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20"
  });
  const normalizedQuery = q.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return apiGet<ClubMembersResponse>(
    `/api/clubs/${linkName}/members?${params.toString()}`
  );
};

export const getClubBans = (linkName: string, page = 1) =>
  apiGet<ClubBansResponse>(`/api/clubs/${linkName}/bans?page=${page}&limit=20`);

export const getClubMilestones = (linkName: string, page = 1) =>
  apiGet<ClubMilestonesResponse>(
    `/api/clubs/${linkName}/milestones?page=${page}&limit=100`
  );

export const getClubProgress = (linkName: string) =>
  apiGet<ClubProgressResponse>(`/api/clubs/${linkName}/progress`);

export const getClubPosts = (
  linkName: string,
  tab: ClubFeedTab,
  cursor: string | null = null
) => {
  const params = new URLSearchParams({
    tab,
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<ClubPostsResponse>(`/api/clubs/${linkName}/posts?${params}`);
};

export const getRecentlyUnlockedPosts = (
  linkName: string,
  cursor: string | null = null
) => {
  const params = new URLSearchParams({
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<RecentlyUnlockedResponse>(
    `/api/clubs/${linkName}/recently-unlocked?${params}`
  );
};

export const getClubDashboardStats = (linkName: string) =>
  apiGet<ClubDashboardStatsResponse>(`/api/clubs/${linkName}/stats`);

export const getClubProgressSummary = (linkName: string) =>
  apiGet<ProgressSummaryResponse>(`/api/clubs/${linkName}/progress/summary`);

export const getPopularDiscussions = (linkName: string) =>
  apiGet<PopularDiscussionsResponse>(
    `/api/clubs/${linkName}/popular-discussions?limit=5`
  );

export const getRecentlyUnlockedSummary = (linkName: string) =>
  apiGet<RecentlyUnlockedSummaryResponse>(
    `/api/clubs/${linkName}/recently-unlocked/summary?limit=3`
  );

export const getPostById = (postId: string) =>
  apiGet<PostDetailResponse>(`/api/posts/${postId}`);

export const getPostComments = (postId: string, cursor?: string) => {
  const params = new URLSearchParams({
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<PostCommentsResponse>(
    `/api/posts/${postId}/comments?${params.toString()}`
  );
};

export const revealPost = (postId: string) =>
  apiPost<RevealPostResponse>(`/api/posts/${postId}/reveal`);

export const togglePostReaction = (
  postId: string,
  input: TogglePostReactionInput
) =>
  apiPost<TogglePostReactionResponse, TogglePostReactionInput>(
    `/api/posts/${postId}/reactions/toggle`,
    input
  );

export const deletePost = (postId: string) =>
  apiPost<DeletePostResponse>(`/api/posts/${postId}/delete`);

export const toggleCommentReaction = (
  commentId: string,
  input: ToggleCommentReactionInput
) =>
  apiPost<ToggleCommentReactionResponse, ToggleCommentReactionInput>(
    `/api/comments/${commentId}/reactions/toggle`,
    input
  );

export const deleteComment = (commentId: string) =>
  apiPost<DeleteCommentResponse>(`/api/comments/${commentId}/delete`);

export const revealPostComment = (postId: string, commentId: string) =>
  apiPost<RevealCommentResponse>(
    `/api/posts/${postId}/comments/${commentId}/reveal`
  );

export const getJoinedClubs = (input: JoinedClubsQueryInput = {}) => {
  const params = new URLSearchParams();
  const query = input.q?.trim();

  if (query) {
    params.set("q", query);
  }

  if (input.page) {
    params.set("page", String(input.page));
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const queryString = params.toString();

  return apiGet<JoinedClubsResponse>(
    queryString ? `/api/users/me/clubs?${queryString}` : "/api/users/me/clubs"
  );
};

export const createClub = (input: CreateClubInput) =>
  apiPost<ClubResponse, CreateClubInput>("/api/clubs", input);

export const createClubPost = (linkName: string, input: CreateClubPostInput) =>
  apiPost<CreateClubPostResponse, CreateClubPostInput>(
    `/api/clubs/${linkName}/posts`,
    input
  );

export const createPostComment = (
  postId: string,
  input: CreatePostCommentInput
) =>
  apiPost<CreatePostCommentResponse, CreatePostCommentInput>(
    `/api/posts/${postId}/comments`,
    input
  );

export const createReport = (input: CreateReportInput) =>
  apiPost<CreateReportResponse, CreateReportInput>("/api/reports", input);

export const updateClubSettings = (
  linkName: string,
  input: UpdateClubSettingsInput
) =>
  apiPatch<ClubResponse, UpdateClubSettingsInput>(
    `/api/clubs/${linkName}/settings`,
    input
  );

export const updateClubMemberRole = (
  linkName: string,
  membershipId: string,
  input: UpdateClubMemberRoleInput
) =>
  apiPatch<ClubMemberResponse, UpdateClubMemberRoleInput>(
    `/api/clubs/${linkName}/members/${membershipId}/role`,
    input
  );

export const banClubMember = (
  linkName: string,
  membershipId: string,
  input: BanClubMemberInput = {}
) =>
  apiPost<ClubBanResponse, BanClubMemberInput>(
    `/api/clubs/${linkName}/members/${membershipId}/ban`,
    input
  );

export const unbanClubBan = (linkName: string, banId: string) =>
  apiPost<ClubBanResponse>(`/api/clubs/${linkName}/bans/${banId}/unban`);

export const getModerationReports = (
  linkName: string,
  cursor: string | null = null
) => {
  const params = new URLSearchParams({
    status: "OPEN",
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<ModerationReportsResponse>(
    `/api/clubs/${linkName}/moderation/reports?${params}`
  );
};

export const revealModerationReport = (linkName: string, reportId: string) =>
  apiPost<RevealModerationReportResponse>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/reveal`
  );

export const updateReportRequiredMilestone = (
  linkName: string,
  reportId: string,
  input: UpdateReportRequiredMilestoneInput
) =>
  apiPatch<ModerationReportActionResponse, UpdateReportRequiredMilestoneInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/required-milestone`,
    input
  );

export const hideReportedContent = (
  linkName: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/hide`,
    input
  );

export const deleteReportedContent = (
  linkName: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/delete`,
    input
  );

export const warnReportedContentAuthor = (
  linkName: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/warn`,
    input
  );

export const banReportedContentAuthor = (
  linkName: string,
  reportId: string,
  input: BanReportedContentAuthorInput
) =>
  apiPost<ModerationReportActionResponse, BanReportedContentAuthorInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/ban`,
    input
  );

export const resolveModerationReport = (
  linkName: string,
  reportId: string,
  input: ResolveModerationReportInput
) =>
  apiPatch<ModerationReportActionResponse, ResolveModerationReportInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/resolve`,
    input
  );

export const createClubMilestone = (
  linkName: string,
  input: CreateClubMilestoneInput
) =>
  apiPost<CreateClubMilestoneResponse, CreateClubMilestoneInput>(
    `/api/clubs/${linkName}/milestones`,
    input
  );

export const updateClubMilestone = (
  linkName: string,
  milestoneId: string,
  input: UpdateClubMilestoneInput
) =>
  apiPatch<UpdateClubMilestoneResponse, UpdateClubMilestoneInput>(
    `/api/clubs/${linkName}/milestones/${milestoneId}`,
    input
  );

export const moveClubMilestone = (
  linkName: string,
  input: MoveClubMilestoneInput
) =>
  apiPost<
    MoveClubMilestoneResponse,
    { direction: MoveClubMilestoneInput["direction"] }
  >(
    `/api/clubs/${linkName}/milestones/${input.milestoneId}/move`,
    {
      direction: input.direction
    }
  );

export const createClubMilestoneTemplate = (
  linkName: string,
  input: CreateClubMilestoneTemplateInput
) =>
  apiPost<
    CreateClubMilestoneTemplateResponse,
    CreateClubMilestoneTemplateInput
  >(`/api/clubs/${linkName}/milestones/templates`, input);

export const joinClub = (linkName: string) =>
  apiPost<ClubResponse>(`/api/clubs/${linkName}/join`);

export const leaveClub = (linkName: string) =>
  apiPost<LeaveClubResponse>(`/api/clubs/${linkName}/leave`);

export const updateClubProgress = (
  linkName: string,
  input: UpdateClubProgressInput
) =>
  apiPatch<ClubProgressResponse, UpdateClubProgressInput>(
    `/api/clubs/${linkName}/progress`,
    input
  );

export const advanceClubProgressToNextMilestone = (linkName: string) =>
  apiPost<ClubProgressResponse>(`/api/clubs/${linkName}/progress/next`);

export const usePublicClubsQuery = (
  enabled = true,
  input: PublicClubsQueryInput = {}
) =>
  useQuery({
    queryKey: clubsQueryKeys.discovery(input),
    queryFn: () => getPublicClubs(input),
    enabled
  });

export const useClubQuery = (linkName: string) =>
  useQuery({
    queryKey: clubsQueryKeys.detail(linkName),
    queryFn: () => getClubByLinkName(linkName),
    enabled: linkName.length > 0
  });

export const useClubMilestonesQuery = (
  linkName: string,
  page: number,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.milestones(linkName, page),
    queryFn: () => getClubMilestones(linkName, page),
    enabled: enabled && linkName.length > 0
  });

export const useClubProgressQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.progress(linkName),
    queryFn: () => getClubProgress(linkName),
    enabled: enabled && linkName.length > 0
  });

export const useClubMembersQuery = (
  linkName: string,
  page: number,
  q = "",
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.members(linkName, { page, q }),
    queryFn: () => getClubMembers(linkName, { page, q }),
    enabled: enabled && linkName.length > 0
  });

export const useClubBansQuery = (
  linkName: string,
  page: number,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.bans(linkName, page),
    queryFn: () => getClubBans(linkName, page),
    enabled: enabled && linkName.length > 0
  });

export const useClubPostsInfiniteQuery = (
  linkName: string,
  tab: ClubFeedTab
) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.feed(linkName, tab),
    queryFn: ({ pageParam }) => getClubPosts(linkName, tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: linkName.length > 0
  });

export const useRecentlyUnlockedQuery = (linkName: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.recentlyUnlocked(linkName),
    queryFn: ({ pageParam }) => getRecentlyUnlockedPosts(linkName, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: enabled && linkName.length > 0
  });

export const useClubDashboardStatsQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardStats(linkName),
    queryFn: () => getClubDashboardStats(linkName),
    enabled: enabled && linkName.length > 0
  });

export const useClubProgressSummaryQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardProgressSummary(linkName),
    queryFn: () => getClubProgressSummary(linkName),
    enabled: enabled && linkName.length > 0
  });

export const usePopularDiscussionsQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardPopularDiscussions(linkName),
    queryFn: () => getPopularDiscussions(linkName),
    enabled: enabled && linkName.length > 0
  });

export const useRecentlyUnlockedSummaryQuery = (
  linkName: string,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardRecentlyUnlockedSummary(linkName),
    queryFn: () => getRecentlyUnlockedSummary(linkName),
    enabled: enabled && linkName.length > 0
  });

export const usePostQuery = (postId: string) =>
  useQuery({
    queryKey: clubsQueryKeys.postDetail(postId),
    queryFn: () => getPostById(postId),
    enabled: postId.length > 0
  });

export const usePostCommentsQuery = (postId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.postComments(postId),
    queryFn: ({ pageParam }) => getPostComments(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    enabled: enabled && postId.length > 0
  });

export const useJoinedClubsQuery = (
  options: boolean | JoinedClubsQueryOptions = true
) => {
  const queryOptions =
    typeof options === "boolean" ? { enabled: options } : options;
  const queryInput = {
    q: queryOptions.q,
    page: queryOptions.page,
    limit: queryOptions.limit
  };
  const hasCustomQuery =
    Boolean(queryInput.q?.trim()) || queryInput.page || queryInput.limit;

  return useQuery({
    queryKey: hasCustomQuery
      ? clubsQueryKeys.joinedList(queryInput)
      : clubsQueryKeys.joined,
    queryFn: () => getJoinedClubs(queryInput),
    enabled: queryOptions.enabled ?? true
  });
};

export const useJoinedClubsInfiniteQuery = (
  options: Omit<JoinedClubsQueryOptions, "page"> = {}
) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.joinedList({
      q: options.q,
      limit: options.limit
    }),
    queryFn: ({ pageParam }) =>
      getJoinedClubs({
        q: options.q,
        limit: options.limit,
        page: pageParam
      }),
    enabled: options.enabled ?? true,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.pageCount
        ? lastPage.pagination.page + 1
        : undefined
  });

export const useCreateClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.linkName),
        response
      );
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discoveryRoot
  });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
    }
  });
};

export const useCreateClubMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubMilestoneInput) =>
      createClubMilestone(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueriesData<ClubMilestonesResponse>(
        {
          queryKey: clubsQueryKeys.milestonesRoot(linkName)
        },
        (currentResponse) => {
          if (!currentResponse) {
            return currentResponse;
          }

          return {
            ...currentResponse,
            milestones: currentResponse.milestones.map((milestone) =>
              milestone.id === response.milestone.id
                ? response.milestone
                : milestone
            )
          };
        }
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useCreateClubPostMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubPostInput) => createClubPost(linkName, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.feedRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useCreatePostCommentMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostCommentInput) =>
      createPostComment(postId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postComments(postId)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("feed")
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
    }
  });
};

export const useCreateReportMutation = () =>
  useMutation({
    mutationFn: createReport
  });

export const useUpdateClubSettingsMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateClubSettingsInput) =>
      updateClubSettings(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.detail(linkName), response);
      refreshClubSettingsQueries(queryClient, linkName);
    }
  });
};

export const useUpdateClubMemberRoleMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      input
    }: {
      membershipId: string;
      input: UpdateClubMemberRoleInput;
    }) => updateClubMemberRole(linkName, membershipId, input),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useBanClubMemberMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      input = {}
    }: {
      membershipId: string;
      input?: BanClubMemberInput;
    }) => banClubMember(linkName, membershipId, input),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useUnbanClubBanMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (banId: string) => unbanClubBan(linkName, banId),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useModerationReportsQuery = (linkName: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.moderationReports(linkName),
    queryFn: ({ pageParam }) => getModerationReports(linkName, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: enabled && linkName.length > 0
  });

export const useRevealModerationReportMutation = (linkName: string) =>
  useMutation({
    mutationFn: (reportId: string) => revealModerationReport(linkName, reportId)
  });

export const useUpdateReportRequiredMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: UpdateReportRequiredMilestoneInput;
    }) => updateReportRequiredMilestone(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useHideReportedContentMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => hideReportedContent(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useDeleteReportedContentMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => deleteReportedContent(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useWarnReportedContentAuthorMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => warnReportedContentAuthor(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
      void queryClient.invalidateQueries({
        queryKey: ["notifications"]
      });
    }
  });
};

export const useBanReportedContentAuthorMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: BanReportedContentAuthorInput;
    }) => banReportedContentAuthor(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useResolveModerationReportMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ResolveModerationReportInput;
    }) => resolveModerationReport(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useRevealPostMutation = (postId: string) =>
  useMutation({
    mutationFn: () => revealPost(postId)
  });

export const useDeletePostMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      removePostFromPostListQueries(queryClient, postId);
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postsRoot
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
    }
  });
};

export const useTogglePostReactionMutation = (
  postId: string,
  options: {
    onOptimisticPost?: (post: ClubPostCard) => void;
    onReconciledPost?: (post: ClubPostCard) => void;
    onRollbackPost?: (post: ClubPostCard | null) => void;
  } = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TogglePostReactionInput) =>
      togglePostReaction(postId, input),
    onMutate: (input) => {
      const previousPostDetail =
        queryClient.getQueryData<PostDetailResponse>(
          clubsQueryKeys.postDetail(postId)
        ) ?? null;
      const previousFeeds = queryClient
        .getQueriesData<InfiniteData<ClubPostsResponse>>({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        })
        .map(([queryKey, value]) => [queryKey, value] as const);
      const optimisticPost = previousPostDetail
        ? togglePostReactionOnCard(previousPostDetail.post, input.emoji)
        : null;

      if (previousPostDetail && optimisticPost) {
        queryClient.setQueryData<PostDetailResponse>(
          clubsQueryKeys.postDetail(postId),
          {
            ...previousPostDetail,
            post: optimisticPost
          }
        );
        options.onOptimisticPost?.(optimisticPost);
      }

      queryClient.setQueriesData<InfiniteData<ClubPostsResponse>>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        },
        (currentData) =>
          updatePostInInfiniteData(currentData, (post) =>
            post.id === postId
              ? togglePostReactionOnCard(post, input.emoji)
              : post
          )
      );

      void queryClient.cancelQueries(
        {
          queryKey: clubsQueryKeys.postDetail(postId)
        },
        {
          revert: false
        }
      );
      void queryClient.cancelQueries(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        },
        {
          revert: false
        }
      );

      return {
        previousPostDetail,
        previousFeeds
      };
    },
    onError: (_error, _input, context) => {
      if (context?.previousPostDetail) {
        queryClient.setQueryData(
          clubsQueryKeys.postDetail(postId),
          context.previousPostDetail
        );
        options.onRollbackPost?.(context.previousPostDetail.post);
      } else {
        options.onRollbackPost?.(null);
      }

      for (const [queryKey, value] of context?.previousFeeds ?? []) {
        queryClient.setQueryData(queryKey, value);
      }
    },
    onSuccess: (response) => {
      queryClient.setQueryData<PostDetailResponse>(
        clubsQueryKeys.postDetail(postId),
        (currentResponse) =>
          currentResponse
            ? {
                ...currentResponse,
                post: response.post
              }
            : currentResponse
      );
      queryClient.setQueriesData<InfiniteData<ClubPostsResponse>>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        },
        (currentData) =>
          updatePostInInfiniteData(currentData, (post) =>
            post.id === postId ? response.post : post
          )
      );
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
      options.onReconciledPost?.(response.post);
    }
  });
};

export const useToggleCommentReactionMutation = (
  postId: string,
  commentId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ToggleCommentReactionInput) =>
      toggleCommentReaction(commentId, input),
    onMutate: (input) => {
      const previousComments =
        queryClient.getQueryData<InfiniteData<PostCommentsResponse>>(
          clubsQueryKeys.postComments(postId)
        ) ?? null;

      queryClient.setQueryData<InfiniteData<PostCommentsResponse>>(
        clubsQueryKeys.postComments(postId),
        (currentData) =>
          updateCommentInInfiniteData(currentData, (comment) =>
            comment.id === commentId
              ? toggleCommentReactionOnComment(comment, input.emoji)
              : comment
          )
      );

      void queryClient.cancelQueries(
        {
          queryKey: clubsQueryKeys.postComments(postId)
        },
        {
          revert: false
        }
      );

      return {
        previousComments
      };
    },
    onError: (_error, _input, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          clubsQueryKeys.postComments(postId),
          context.previousComments
        );
      }
    },
    onSuccess: (response) => {
      queryClient.setQueryData<InfiniteData<PostCommentsResponse>>(
        clubsQueryKeys.postComments(postId),
        (currentData) =>
          updateCommentInInfiniteData(currentData, (comment) =>
            comment.id === response.comment.id ? response.comment : comment
          )
      );
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
    }
  });
};

export const useDeleteCommentMutation = (
  postId: string,
  commentId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteComment(commentId),
    onSuccess: () => {
      queryClient.setQueryData<InfiniteData<PostCommentsResponse>>(
        clubsQueryKeys.postComments(postId),
        (currentData) => removeCommentFromInfiniteData(currentData, commentId)
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          (query.queryKey.includes("feed") ||
            query.queryKey.includes("dashboard"))
      });
    }
  });
};

export const useRevealPostCommentMutation = (postId: string) =>
  useMutation({
    mutationFn: (commentId: string) => revealPostComment(postId, commentId)
  });

export const useCreateClubMilestoneTemplateMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubMilestoneTemplateInput) =>
      createClubMilestoneTemplate(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueriesData<ClubMilestonesResponse>(
        {
          queryKey: clubsQueryKeys.milestonesRoot(linkName)
        },
        (currentResponse) => {
          if (!currentResponse) {
            return currentResponse;
          }

          const { page, limit } = currentResponse.pagination;
          const start = (page - 1) * limit;

          return {
            milestones: response.milestones.slice(start, start + limit),
            pagination: {
              ...currentResponse.pagination,
              total: response.milestones.length,
              pageCount: Math.ceil(response.milestones.length / limit)
            }
          };
        }
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useUpdateClubMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      input
    }: {
      milestoneId: string;
      input: UpdateClubMilestoneInput;
    }) => updateClubMilestone(linkName, milestoneId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useMoveClubMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MoveClubMilestoneInput) =>
      moveClubMilestone(linkName, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useUpdateClubProgressMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateClubProgressInput) =>
      updateClubProgress(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.progress(linkName), response);
      invalidateClubProgressDependencies(queryClient, linkName);
    }
  });
};

export const useAdvanceClubProgressMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => advanceClubProgressToNextMilestone(linkName),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.progress(linkName), response);
      invalidateClubProgressDependencies(queryClient, linkName);
    }
  });
};

export const invalidateClubProgressDependencies = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.progress(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.milestonesRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.recentlyUnlocked(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.postsRoot
  });
};

export const useJoinClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.linkName),
        response
      );
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discoveryRoot
  });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(response.club.linkName)
      });
    }
  });
};

export const useLeaveClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveClub,
    onSuccess: (response) => {
      queryClient.removeQueries({
        queryKey: clubsQueryKeys.detail(response.club.linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discoveryRoot
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(response.club.linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.feedRoot(response.club.linkName)
      });
    }
  });
};

const updatePostInInfiniteData = (
  currentData: InfiniteData<ClubPostsResponse> | undefined,
  updatePost: (post: ClubPostCard) => ClubPostCard
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      posts: page.posts.map(updatePost)
    }))
  };
};

const removePostFromPostListQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string
) => {
  queryClient.setQueriesData<InfiniteData<{ posts: ClubPostCard[] }>>(
    {
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey.includes("feed") ||
          query.queryKey.includes("recently-unlocked") ||
          query.queryKey.includes("search"))
    },
    (currentData) => removePostFromInfiniteData(currentData, postId)
  );
};

const removePostFromInfiniteData = <TPage extends { posts: ClubPostCard[] }>(
  currentData: InfiniteData<TPage> | undefined,
  postId: string
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      posts: page.posts.filter((post) => post.id !== postId)
    }))
  };
};

const updateCommentInInfiniteData = (
  currentData: InfiniteData<PostCommentsResponse> | undefined,
  updateComment: (comment: Comment) => Comment
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      comments: page.comments.map(updateComment)
    }))
  };
};

const removeCommentFromInfiniteData = (
  currentData: InfiniteData<PostCommentsResponse> | undefined,
  commentId: string
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      comments: page.comments.filter((comment) => comment.id !== commentId)
    }))
  };
};

export const togglePostReactionOnCard = (
  post: ClubPostCard,
  emoji: PostReactionEmoji
): ClubPostCard => {
  if (post.visibility === "LOCKED") {
    return post;
  }

  const reactions = post.counts.reactions.map((reaction) => {
    if (reaction.emoji !== emoji) {
      return reaction;
    }

    const reactedByMe = !reaction.reactedByMe;
    const count = reactedByMe
      ? reaction.count + 1
      : Math.max(0, reaction.count - 1);

    return {
      ...reaction,
      count,
      reactedByMe
    };
  });

  return {
    ...post,
    counts: {
      ...post.counts,
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions
    }
  };
};

export const toggleCommentReactionOnComment = (
  comment: Comment,
  emoji: CommentReactionEmoji
): Comment => {
  if (comment.visibility === "LOCKED") {
    return comment;
  }

  const reactions = comment.counts.reactions.map((reaction) => {
    if (reaction.emoji !== emoji) {
      return reaction;
    }

    const reactedByMe = !reaction.reactedByMe;
    const count = reactedByMe
      ? reaction.count + 1
      : Math.max(0, reaction.count - 1);

    return {
      ...reaction,
      count,
      reactedByMe
    };
  });

  return {
    ...comment,
    counts: {
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions
    }
  };
};
