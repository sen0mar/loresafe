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

export type PredictionStatus = "UNRESOLVED" | "CORRECT" | "WRONG" | "PARTIAL";

export type PostReactionEmoji = "👍" | "❤️" | "😂" | "😮" | "👀";
export type CommentReactionEmoji = PostReactionEmoji;

export const postReactionEmojis: PostReactionEmoji[] = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "👀"
];
export type ClubFeedTab = "safe" | "unanswered" | "locked" | "all" | "my-posts";
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
export type RevealCommentResponse = {
  comment: RevealedComment;
};
