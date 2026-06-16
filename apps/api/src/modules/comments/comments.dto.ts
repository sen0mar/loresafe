import type { ProgressMode } from "../progress/progress.schema.js";
import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { CommentRecord } from "./comments.repository.js";

export type CommentStatusDto = "VISIBLE" | "HIDDEN";

type RequiredMilestoneDto = {
  id: string;
  position: number;
  label: string;
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
  createdAt: string;
  updatedAt: string;
};

export type LockedCommentDto = {
  id: string;
  visibility: "LOCKED";
  status: CommentStatusDto;
  parentId: string | null;
  requiredMilestone: RequiredMilestoneDto;
  lockReason: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentDto = VisibleCommentDto | LockedCommentDto;

export type PostCommentsResponse = {
  comments: CommentDto[];
};

export type CreatePostCommentResponse = {
  comment: CommentDto;
};

export type CommentVisibilityContext = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
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
