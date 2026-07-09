import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { ClubPostRecord } from "./posts.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { PostReactionEmoji } from "./posts.schema.js";
import type { ObjectStorage } from "../../core/storage/r2-storage.js";
import { canDeletePost } from "./posts.policy.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type PostTypeDto =
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

export type PostStatusDto = "VISIBLE" | "HIDDEN";

export type PredictionStatusDto =
  | "UNRESOLVED"
  | "CORRECT"
  | "WRONG"
  | "PARTIAL";

type PostCountsDto = {
  commentCount: number;
  reactionCount: number;
  unreadCommentCount: number;
  reactions: Array<{
    emoji: PostReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
};

type RequiredMilestoneDto = {
  id: string;
  position: number;
  label: string;
};

type ContentPermissionsDto = {
  canDelete: boolean;
};

type PredictionDto = {
  status: PredictionStatusDto;
  revealMilestone: RequiredMilestoneDto;
};

export type PostMediaDto = {
  id: string;
  contentType: string;
  sizeBytes: number;
  safePreview: boolean;
  url: string;
  urlExpiresAt: string;
};

export type VisibleClubPostCardDto = {
  id: string;
  visibility: "VISIBLE";
  type: PostTypeDto;
  status: PostStatusDto;
  title: string;
  bodyPreview: string;
  author: {
    id: string;
    displayName: string;
    username: string | null;
  };
  requiredMilestone: RequiredMilestoneDto;
  prediction?: PredictionDto;
  media?: PostMediaDto;
  permissions: ContentPermissionsDto;
  counts: PostCountsDto;
  createdAt: string;
  updatedAt: string;
};

export type LockedClubPostCardDto = {
  id: string;
  visibility: "LOCKED";
  type: PostTypeDto;
  status: PostStatusDto;
  requiredMilestone: RequiredMilestoneDto;
  counts: PostCountsDto;
  permissions: ContentPermissionsDto;
  lockReason: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubPostCardDto =
  | VisibleClubPostCardDto
  | LockedClubPostCardDto;

export type RevealedClubPostDto = Omit<
  VisibleClubPostCardDto,
  "bodyPreview" | "visibility"
> & {
  visibility: "REVEALED";
  body: string;
};

export type ClubPostsResponse = {
  posts: ClubPostCardDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type CreateClubPostResponse = {
  post: ClubPostCardDto;
};

type PostDetailClubDto = {
  id: string;
  linkName: string;
};

export type PostDetailResponse = {
  post: ClubPostCardDto;
  club: PostDetailClubDto;
};

export type RevealPostResponse = {
  post: RevealedClubPostDto;
  club: PostDetailClubDto;
};

export type TogglePostReactionResponse = {
  post: ClubPostCardDto;
};

export type DeletePostResponse = {
  post: {
    id: string;
    deletedAt: string;
  };
};

export type PostVisibilityContext = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
  currentUserId: string;
  currentUserRole: ClubMembershipRole | null;
};

export const toClubPostCardDto = async (
  post: ClubPostRecord,
  context: PostVisibilityContext,
  storage: Pick<ObjectStorage, "createPresignedRead">
): Promise<ClubPostCardDto> => {
  const requiredMilestone = {
    id: post.requiredMilestone.id,
    position: post.requiredMilestone.position,
    label: post.requiredMilestone.safeTitle
  };
  const base = {
    id: post.id,
    type: post.type,
    status: post.status,
    requiredMilestone,
    permissions: toPostPermissionsDto(post, context),
    counts: {
      commentCount: post.commentCount,
      reactionCount: post.reactionCount,
      unreadCommentCount: 0,
      reactions: post.reactions
    },
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString()
  };
  const prediction = toPredictionDto(post);
  const isVisible = canViewRequiredMilestone({
    mode: context.mode,
    currentMilestonePosition: context.currentMilestonePosition,
    requiredMilestonePosition: post.requiredMilestone.position
  });

  if (!isVisible) {
    return toLockedPostDto({
      base,
      requiredMilestone
    });
  }

  return toVisiblePostDto({
    base,
    post,
    prediction,
    storage
  });
};

export const toRevealedClubPostDto = async (
  post: ClubPostRecord,
  context: PostVisibilityContext,
  storage: Pick<ObjectStorage, "createPresignedRead">
): Promise<RevealedClubPostDto> => {
  const prediction = toPredictionDto(post);
  const media = await toPostMediaDto(post.media, storage);

  return {
    id: post.id,
    visibility: "REVEALED",
    type: post.type,
    status: post.status,
    title: post.title,
    body: post.body,
    author: {
      id: post.author.id,
      displayName: post.author.displayName,
      username: post.author.username
    },
    requiredMilestone: {
      id: post.requiredMilestone.id,
      position: post.requiredMilestone.position,
      label: post.requiredMilestone.safeTitle
    },
    ...(prediction ? { prediction } : {}),
    ...(media ? { media } : {}),
    permissions: toPostPermissionsDto(post, context),
    counts: {
      commentCount: post.commentCount,
      reactionCount: post.reactionCount,
      unreadCommentCount: 0,
      reactions: post.reactions
    },
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString()
  };
};

const toLockedPostDto = ({
  base,
  requiredMilestone
}: {
  base: Omit<LockedClubPostCardDto, "visibility" | "lockReason">;
  requiredMilestone: RequiredMilestoneDto;
}): LockedClubPostCardDto => ({
    ...base,
    visibility: "LOCKED",
    lockReason: `Reach milestone ${requiredMilestone.position}: ${requiredMilestone.label} to unlock this discussion.`
  });

const toVisiblePostDto = async ({
  base,
  post,
  prediction,
  storage
}: {
  base: Omit<
    VisibleClubPostCardDto,
    "visibility" | "title" | "bodyPreview" | "author" | "prediction" | "media"
  >;
  post: ClubPostRecord;
  prediction: PredictionDto | null;
  storage: Pick<ObjectStorage, "createPresignedRead">;
}): Promise<VisibleClubPostCardDto> => {
  const media = await toPostMediaDto(post.media, storage);

  return {
    ...base,
    visibility: "VISIBLE",
    title: post.title,
    bodyPreview: toBodyPreview(post.body),
    author: {
      id: post.author.id,
      displayName: post.author.displayName,
      username: post.author.username
    },
    ...(prediction ? { prediction } : {}),
    ...(media ? { media } : {})
  };
};

const toPostMediaDto = async (
  media: ClubPostRecord["media"],
  storage: Pick<ObjectStorage, "createPresignedRead">
): Promise<PostMediaDto | null> => {
  if (!media) {
    return null;
  }

  const signedRead = await storage.createPresignedRead(media.objectKey);

  return {
    id: media.id,
    contentType: media.contentType,
    sizeBytes: media.sizeBytes,
    safePreview: media.safePreview,
    url: signedRead.readUrl,
    urlExpiresAt: signedRead.expiresAt.toISOString()
  };
};

const toPredictionDto = (post: ClubPostRecord): PredictionDto | null => {
  if (!post.prediction) {
    return null;
  }

  return {
    status: post.prediction.status,
    revealMilestone: {
      id: post.prediction.revealMilestone.id,
      position: post.prediction.revealMilestone.position,
      label: post.prediction.revealMilestone.safeTitle
    }
  };
};

const toPostPermissionsDto = (
  post: ClubPostRecord,
  context: PostVisibilityContext
): ContentPermissionsDto => ({
  canDelete: canDeletePost({
    authorId: post.author.id,
    currentUserId: context.currentUserId,
    currentUserRole: context.currentUserRole
  })
});

const toBodyPreview = (body: string) => {
  const compactBody = body.replace(/\s+/g, " ").trim();

  if (compactBody.length <= 180) {
    return compactBody;
  }

  return `${compactBody.slice(0, 177).trimEnd()}...`;
};
