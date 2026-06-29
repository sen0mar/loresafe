import type { ProgressMode } from "../progress/progress.schema.js";
import type { CommentReactionEmoji } from "./comments.schema.js";
import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { CommentRecord } from "./comments.repository.js";
import { canDeleteComment } from "./comments.policy.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type CommentStatusDto = "VISIBLE" | "HIDDEN";

type RequiredMilestoneDto = {
  id: string;
  position: number;
  label: string;
};

type ContentPermissionsDto = {
  canDelete: boolean;
};

export type CommentReactionCountsDto = {
  reactionCount: number;
  reactions: Array<{
    emoji: CommentReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
};

export type VisibleCommentDto = {
  id: string;
  visibility: "VISIBLE";
  status: CommentStatusDto;
  body: string;
  author: {
    id: string;
    displayName: string;
    username: string | null;
  };
  parentId: string | null;
  requiredMilestone: RequiredMilestoneDto;
  counts: CommentReactionCountsDto;
  permissions: ContentPermissionsDto;
  createdAt: string;
  updatedAt: string;
};

export type LockedCommentDto = {
  id: string;
  visibility: "LOCKED";
  status: CommentStatusDto;
  parentId: string | null;
  requiredMilestone: RequiredMilestoneDto;
  counts: CommentReactionCountsDto;
  permissions: ContentPermissionsDto;
  lockReason: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentDto = VisibleCommentDto | LockedCommentDto;

export type RevealedCommentDto = Omit<VisibleCommentDto, "visibility"> & {
  visibility: "REVEALED";
};

export type PostCommentsResponse = {
  comments: CommentDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type CreatePostCommentResponse = {
  comment: CommentDto;
};

export type RevealCommentResponse = {
  comment: RevealedCommentDto;
};

export type ToggleCommentReactionResponse = {
  comment: CommentDto;
};

export type DeleteCommentResponse = {
  comment: {
    id: string;
    postId: string;
    deletedAt: string;
  };
};

export type CommentVisibilityContext = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
  currentUserId: string;
  currentUserRole: ClubMembershipRole | null;
};

export const toCommentDto = (
  comment: CommentRecord,
  context: CommentVisibilityContext
): CommentDto => {
  const requiredMilestone = {
    id: comment.requiredMilestone.id,
    position: comment.requiredMilestone.position,
    label: comment.requiredMilestone.safeTitle
  };
  const base = {
    id: comment.id,
    status: comment.status,
    parentId: comment.parentId,
    requiredMilestone,
    permissions: toCommentPermissionsDto(comment, context),
    counts: {
      reactionCount: comment.reactionCount,
      reactions: comment.reactions
    },
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString()
  };
  const isVisible = canViewRequiredMilestone({
    mode: context.mode,
    currentMilestonePosition: context.currentMilestonePosition,
    requiredMilestonePosition: comment.requiredMilestone.position
  });

  if (!isVisible) {
    return {
      ...base,
      visibility: "LOCKED",
      lockReason: `Reach milestone ${requiredMilestone.position}: ${requiredMilestone.label} to unlock this comment.`
    };
  }

  return {
    ...base,
    visibility: "VISIBLE",
    body: comment.body,
    author: {
      id: comment.author.id,
      displayName: comment.author.displayName,
      username: comment.author.username
    }
  };
};

export const toRevealedCommentDto = (
  comment: CommentRecord,
  context: CommentVisibilityContext
): RevealedCommentDto => ({
  id: comment.id,
  visibility: "REVEALED",
  status: comment.status,
  body: comment.body,
  author: {
    id: comment.author.id,
    displayName: comment.author.displayName,
    username: comment.author.username
  },
  parentId: comment.parentId,
  requiredMilestone: {
    id: comment.requiredMilestone.id,
    position: comment.requiredMilestone.position,
    label: comment.requiredMilestone.safeTitle
  },
  permissions: toCommentPermissionsDto(comment, context),
  counts: {
    reactionCount: comment.reactionCount,
    reactions: comment.reactions
  },
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString()
});

const toCommentPermissionsDto = (
  comment: CommentRecord,
  context: CommentVisibilityContext
): ContentPermissionsDto => ({
  canDelete: canDeleteComment({
    authorId: comment.author.id,
    currentUserId: context.currentUserId,
    currentUserRole: context.currentUserRole
  })
});
