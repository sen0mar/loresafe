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
  active: boolean;
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
  active: boolean;
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
  cursor?: string;
  q?: string;
  limit?: number;
};

export type JoinedClubsQueryOptions = JoinedClubsQueryInput & {
  enabled?: boolean;
};
