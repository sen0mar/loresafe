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

export type ProgressMode = "STRICT" | "SOFT" | "BRAVE" | "FINISHED";

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
  slug: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Club = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
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

export type JoinedClub = {
  id: string;
  title: string;
  slug: string;
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
  media?: ClubPostMedia;
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

export type ClubResponse = {
  club: Club;
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

export type ClubMemberResponse = {
  member: ClubMember;
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
    slug: string;
  };
};

export type RevealPostResponse = {
  post: RevealedClubPost;
  club: {
    id: string;
    slug: string;
  };
};

export type TogglePostReactionInput = {
  emoji: PostReactionEmoji;
};

export type TogglePostReactionResponse = {
  post: ClubPostCard;
};

export type ToggleCommentReactionInput = {
  emoji: CommentReactionEmoji;
};

export type ToggleCommentReactionResponse = {
  comment: Comment;
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
};

export type CreateClubMilestoneTemplateResponse = {
  milestones: ClubMilestone[];
};

export type CreateClubInput = {
  title: string;
  slug: string;
  description?: string | null;
  category?: string | null;
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

export type BanClubMemberInput = {
  reason?: string | null;
  expiresAt?: string;
};

export const refreshClubAssetQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discovery
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
};

export const refreshClubMemberManagementQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.membersRoot(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(slug)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("comments")
  });
};

const reconcileModerationReportMutation = (
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
  report: ModerationReport
) => {
  queryClient.setQueryData<InfiniteData<ModerationReportsResponse>>(
    clubsQueryKeys.moderationReports(slug),
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
    queryKey: clubsQueryKeys.feedRoot(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.moderationReports(slug)
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
  discovery: ["clubs", "discovery"] as const,
  joined: ["users", "me", "clubs"] as const,
  detail: (slug: string) => ["clubs", "detail", slug] as const,
  milestonesRoot: (slug: string) =>
    ["clubs", "detail", slug, "milestones"] as const,
  milestones: (slug: string, page: number) =>
    ["clubs", "detail", slug, "milestones", page] as const,
  progress: (slug: string) => ["clubs", "detail", slug, "progress"] as const,
  membersRoot: (slug: string) =>
    ["clubs", "detail", slug, "members"] as const,
  members: (slug: string, page: number) =>
    ["clubs", "detail", slug, "members", page] as const,
  feedRoot: (slug: string) => ["clubs", "detail", slug, "feed"] as const,
  feed: (slug: string, tab: ClubFeedTab) =>
    ["clubs", "detail", slug, "feed", tab] as const,
  dashboardRoot: (slug: string) =>
    ["clubs", "detail", slug, "dashboard"] as const,
  dashboardStats: (slug: string) =>
    ["clubs", "detail", slug, "dashboard", "stats"] as const,
  dashboardProgressSummary: (slug: string) =>
    ["clubs", "detail", slug, "dashboard", "progress-summary"] as const,
  dashboardPopularDiscussions: (slug: string) =>
    ["clubs", "detail", slug, "dashboard", "popular-discussions"] as const,
  dashboardRecentlyUnlockedSummary: (slug: string) =>
    ["clubs", "detail", slug, "dashboard", "recently-unlocked-summary"] as const,
  recentlyUnlocked: (slug: string) =>
    ["clubs", "detail", slug, "recently-unlocked"] as const,
  moderationReports: (slug: string) =>
    ["clubs", "detail", slug, "moderation", "reports"] as const,
  postDetail: (postId: string) => ["posts", "detail", postId] as const,
  postComments: (postId: string) =>
    ["posts", "detail", postId, "comments"] as const
};

export const getPublicClubs = () =>
  apiGet<ClubsDiscoveryResponse>("/api/clubs");

export const getClubBySlug = (slug: string) =>
  apiGet<ClubResponse>(`/api/clubs/${slug}`);

export const getClubMembers = (slug: string, page = 1) =>
  apiGet<ClubMembersResponse>(
    `/api/clubs/${slug}/members?page=${page}&limit=20`
  );

export const getClubMilestones = (slug: string, page = 1) =>
  apiGet<ClubMilestonesResponse>(
    `/api/clubs/${slug}/milestones?page=${page}&limit=100`
  );

export const getClubProgress = (slug: string) =>
  apiGet<ClubProgressResponse>(`/api/clubs/${slug}/progress`);

export const getClubPosts = (
  slug: string,
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

  return apiGet<ClubPostsResponse>(`/api/clubs/${slug}/posts?${params}`);
};

export const getRecentlyUnlockedPosts = (
  slug: string,
  cursor: string | null = null
) => {
  const params = new URLSearchParams({
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<RecentlyUnlockedResponse>(
    `/api/clubs/${slug}/recently-unlocked?${params}`
  );
};

export const getClubDashboardStats = (slug: string) =>
  apiGet<ClubDashboardStatsResponse>(`/api/clubs/${slug}/stats`);

export const getClubProgressSummary = (slug: string) =>
  apiGet<ProgressSummaryResponse>(`/api/clubs/${slug}/progress/summary`);

export const getPopularDiscussions = (slug: string) =>
  apiGet<PopularDiscussionsResponse>(
    `/api/clubs/${slug}/popular-discussions?limit=5`
  );

export const getRecentlyUnlockedSummary = (slug: string) =>
  apiGet<RecentlyUnlockedSummaryResponse>(
    `/api/clubs/${slug}/recently-unlocked/summary?limit=3`
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

export const toggleCommentReaction = (
  commentId: string,
  input: ToggleCommentReactionInput
) =>
  apiPost<ToggleCommentReactionResponse, ToggleCommentReactionInput>(
    `/api/comments/${commentId}/reactions/toggle`,
    input
  );

export const revealPostComment = (postId: string, commentId: string) =>
  apiPost<RevealCommentResponse>(
    `/api/posts/${postId}/comments/${commentId}/reveal`
  );

export const getJoinedClubs = () =>
  apiGet<JoinedClubsResponse>("/api/users/me/clubs");

export const createClub = (input: CreateClubInput) =>
  apiPost<ClubResponse, CreateClubInput>("/api/clubs", input);

export const createClubPost = (slug: string, input: CreateClubPostInput) =>
  apiPost<CreateClubPostResponse, CreateClubPostInput>(
    `/api/clubs/${slug}/posts`,
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

export const updateClubMemberRole = (
  slug: string,
  membershipId: string,
  input: UpdateClubMemberRoleInput
) =>
  apiPatch<ClubMemberResponse, UpdateClubMemberRoleInput>(
    `/api/clubs/${slug}/members/${membershipId}/role`,
    input
  );

export const banClubMember = (
  slug: string,
  membershipId: string,
  input: BanClubMemberInput = {}
) =>
  apiPost<ClubMemberResponse, BanClubMemberInput>(
    `/api/clubs/${slug}/members/${membershipId}/ban`,
    input
  );

export const unbanClubMember = (slug: string, membershipId: string) =>
  apiPost<ClubMemberResponse>(
    `/api/clubs/${slug}/members/${membershipId}/unban`
  );

export const getModerationReports = (
  slug: string,
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
    `/api/clubs/${slug}/moderation/reports?${params}`
  );
};

export const revealModerationReport = (slug: string, reportId: string) =>
  apiPost<RevealModerationReportResponse>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/reveal`
  );

export const updateReportRequiredMilestone = (
  slug: string,
  reportId: string,
  input: UpdateReportRequiredMilestoneInput
) =>
  apiPatch<ModerationReportActionResponse, UpdateReportRequiredMilestoneInput>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/required-milestone`,
    input
  );

export const hideReportedContent = (
  slug: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/hide`,
    input
  );

export const deleteReportedContent = (
  slug: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/delete`,
    input
  );

export const warnReportedContentAuthor = (
  slug: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/warn`,
    input
  );

export const banReportedContentAuthor = (
  slug: string,
  reportId: string,
  input: BanReportedContentAuthorInput
) =>
  apiPost<ModerationReportActionResponse, BanReportedContentAuthorInput>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/ban`,
    input
  );

export const resolveModerationReport = (
  slug: string,
  reportId: string,
  input: ResolveModerationReportInput
) =>
  apiPatch<ModerationReportActionResponse, ResolveModerationReportInput>(
    `/api/clubs/${slug}/moderation/reports/${reportId}/resolve`,
    input
  );

export const createClubMilestone = (
  slug: string,
  input: CreateClubMilestoneInput
) =>
  apiPost<CreateClubMilestoneResponse, CreateClubMilestoneInput>(
    `/api/clubs/${slug}/milestones`,
    input
  );

export const updateClubMilestone = (
  slug: string,
  milestoneId: string,
  input: UpdateClubMilestoneInput
) =>
  apiPatch<UpdateClubMilestoneResponse, UpdateClubMilestoneInput>(
    `/api/clubs/${slug}/milestones/${milestoneId}`,
    input
  );

export const moveClubMilestone = (
  slug: string,
  input: MoveClubMilestoneInput
) =>
  apiPost<
    MoveClubMilestoneResponse,
    { direction: MoveClubMilestoneInput["direction"] }
  >(
    `/api/clubs/${slug}/milestones/${input.milestoneId}/move`,
    {
      direction: input.direction
    }
  );

export const createClubMilestoneTemplate = (
  slug: string,
  input: CreateClubMilestoneTemplateInput
) =>
  apiPost<
    CreateClubMilestoneTemplateResponse,
    CreateClubMilestoneTemplateInput
  >(`/api/clubs/${slug}/milestones/templates`, input);

export const joinClub = (slug: string) =>
  apiPost<ClubResponse>(`/api/clubs/${slug}/join`);

export const updateClubProgress = (
  slug: string,
  input: UpdateClubProgressInput
) =>
  apiPatch<ClubProgressResponse, UpdateClubProgressInput>(
    `/api/clubs/${slug}/progress`,
    input
  );

export const advanceClubProgressToNextMilestone = (slug: string) =>
  apiPost<ClubProgressResponse>(`/api/clubs/${slug}/progress/next`);

export const usePublicClubsQuery = () =>
  useQuery({
    queryKey: clubsQueryKeys.discovery,
    queryFn: getPublicClubs
  });

export const useClubQuery = (slug: string) =>
  useQuery({
    queryKey: clubsQueryKeys.detail(slug),
    queryFn: () => getClubBySlug(slug),
    enabled: slug.length > 0
  });

export const useClubMilestonesQuery = (
  slug: string,
  page: number,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.milestones(slug, page),
    queryFn: () => getClubMilestones(slug, page),
    enabled: enabled && slug.length > 0
  });

export const useClubProgressQuery = (slug: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.progress(slug),
    queryFn: () => getClubProgress(slug),
    enabled: enabled && slug.length > 0
  });

export const useClubMembersQuery = (
  slug: string,
  page: number,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.members(slug, page),
    queryFn: () => getClubMembers(slug, page),
    enabled: enabled && slug.length > 0
  });

export const useClubPostsInfiniteQuery = (
  slug: string,
  tab: ClubFeedTab
) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.feed(slug, tab),
    queryFn: ({ pageParam }) => getClubPosts(slug, tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: slug.length > 0
  });

export const useRecentlyUnlockedQuery = (slug: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.recentlyUnlocked(slug),
    queryFn: ({ pageParam }) => getRecentlyUnlockedPosts(slug, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: enabled && slug.length > 0
  });

export const useClubDashboardStatsQuery = (slug: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardStats(slug),
    queryFn: () => getClubDashboardStats(slug),
    enabled: enabled && slug.length > 0
  });

export const useClubProgressSummaryQuery = (slug: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardProgressSummary(slug),
    queryFn: () => getClubProgressSummary(slug),
    enabled: enabled && slug.length > 0
  });

export const usePopularDiscussionsQuery = (slug: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardPopularDiscussions(slug),
    queryFn: () => getPopularDiscussions(slug),
    enabled: enabled && slug.length > 0
  });

export const useRecentlyUnlockedSummaryQuery = (
  slug: string,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardRecentlyUnlockedSummary(slug),
    queryFn: () => getRecentlyUnlockedSummary(slug),
    enabled: enabled && slug.length > 0
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

export const useJoinedClubsQuery = (enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.joined,
    queryFn: getJoinedClubs,
    enabled
  });

export const useCreateClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.slug),
        response
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discovery
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
    }
  });
};

export const useCreateClubMilestoneMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubMilestoneInput) =>
      createClubMilestone(slug, input),
    onSuccess: (response) => {
      queryClient.setQueriesData<ClubMilestonesResponse>(
        {
          queryKey: clubsQueryKeys.milestonesRoot(slug)
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
        queryKey: clubsQueryKeys.milestonesRoot(slug)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(slug)
      });
    }
  });
};

export const useCreateClubPostMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubPostInput) => createClubPost(slug, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.feedRoot(slug)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(slug)
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

export const useUpdateClubMemberRoleMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      input
    }: {
      membershipId: string;
      input: UpdateClubMemberRoleInput;
    }) => updateClubMemberRole(slug, membershipId, input),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, slug);
    }
  });
};

export const useBanClubMemberMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      input = {}
    }: {
      membershipId: string;
      input?: BanClubMemberInput;
    }) => banClubMember(slug, membershipId, input),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, slug);
    }
  });
};

export const useUnbanClubMemberMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) => unbanClubMember(slug, membershipId),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, slug);
    }
  });
};

export const useModerationReportsQuery = (slug: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.moderationReports(slug),
    queryFn: ({ pageParam }) => getModerationReports(slug, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: enabled && slug.length > 0
  });

export const useRevealModerationReportMutation = (slug: string) =>
  useMutation({
    mutationFn: (reportId: string) => revealModerationReport(slug, reportId)
  });

export const useUpdateReportRequiredMilestoneMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: UpdateReportRequiredMilestoneInput;
    }) => updateReportRequiredMilestone(slug, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, slug, response.report);
    }
  });
};

export const useHideReportedContentMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => hideReportedContent(slug, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, slug, response.report);
    }
  });
};

export const useDeleteReportedContentMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => deleteReportedContent(slug, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, slug, response.report);
    }
  });
};

export const useWarnReportedContentAuthorMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => warnReportedContentAuthor(slug, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, slug, response.report);
      void queryClient.invalidateQueries({
        queryKey: ["notifications"]
      });
    }
  });
};

export const useBanReportedContentAuthorMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: BanReportedContentAuthorInput;
    }) => banReportedContentAuthor(slug, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, slug, response.report);
    }
  });
};

export const useResolveModerationReportMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ResolveModerationReportInput;
    }) => resolveModerationReport(slug, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, slug, response.report);
    }
  });
};

export const useRevealPostMutation = (postId: string) =>
  useMutation({
    mutationFn: () => revealPost(postId)
  });

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
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      await queryClient.cancelQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("feed")
      });

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
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: clubsQueryKeys.postComments(postId)
      });

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

export const useRevealPostCommentMutation = (postId: string) =>
  useMutation({
    mutationFn: (commentId: string) => revealPostComment(postId, commentId)
  });

export const useCreateClubMilestoneTemplateMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubMilestoneTemplateInput) =>
      createClubMilestoneTemplate(slug, input),
    onSuccess: (response) => {
      queryClient.setQueriesData<ClubMilestonesResponse>(
        {
          queryKey: clubsQueryKeys.milestonesRoot(slug)
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
        queryKey: clubsQueryKeys.milestonesRoot(slug)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(slug)
      });
    }
  });
};

export const useUpdateClubMilestoneMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      input
    }: {
      milestoneId: string;
      input: UpdateClubMilestoneInput;
    }) => updateClubMilestone(slug, milestoneId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(slug)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(slug)
      });
    }
  });
};

export const useMoveClubMilestoneMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MoveClubMilestoneInput) =>
      moveClubMilestone(slug, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(slug)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(slug)
      });
    }
  });
};

export const useUpdateClubProgressMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateClubProgressInput) =>
      updateClubProgress(slug, input),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.progress(slug), response);
      invalidateClubProgressDependencies(queryClient, slug);
    }
  });
};

export const useAdvanceClubProgressMutation = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => advanceClubProgressToNextMilestone(slug),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.progress(slug), response);
      invalidateClubProgressDependencies(queryClient, slug);
    }
  });
};

export const invalidateClubProgressDependencies = (
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.progress(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.milestonesRoot(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.recentlyUnlocked(slug)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(slug)
  });
};

export const useJoinClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.slug),
        response
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discovery
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(response.club.slug)
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
