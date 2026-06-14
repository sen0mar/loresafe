import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { ClubPostRecord } from "./posts.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";

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

type PostCountsDto = {
  commentCount: 0;
  reactionCount: 0;
  unreadCommentCount: 0;
};

type RequiredMilestoneDto = {
  id: string;
  position: number;
  label: string;
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
  lockReason: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubPostCardDto =
  | VisibleClubPostCardDto
  | LockedClubPostCardDto;

export type ClubPostsResponse = {
  posts: ClubPostCardDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type PostVisibilityContext = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
};

const zeroCounts: PostCountsDto = {
  commentCount: 0,
  reactionCount: 0,
  unreadCommentCount: 0
};

export const toClubPostCardDto = (
  post: ClubPostRecord,
  context: PostVisibilityContext
): ClubPostCardDto => {
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
    counts: zeroCounts,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString()
  };
  const isVisible = canViewRequiredMilestone({
    mode: context.mode,
    currentMilestonePosition: context.currentMilestonePosition,
    requiredMilestonePosition: post.requiredMilestone.position
  });

  if (!isVisible) {
    return {
      ...base,
      visibility: "LOCKED",
      lockReason: `Reach milestone ${requiredMilestone.position}: ${requiredMilestone.label} to unlock this discussion.`
    };
  }

  return {
    ...base,
    visibility: "VISIBLE",
    title: post.title,
    bodyPreview: toBodyPreview(post.body),
    author: {
      id: post.author.id,
      displayName: post.author.displayName,
      username: post.author.username
    }
  };
};

const toBodyPreview = (body: string) => {
  const compactBody = body.replace(/\s+/g, " ").trim();

  if (compactBody.length <= 180) {
    return compactBody;
  }

  return `${compactBody.slice(0, 177).trimEnd()}...`;
};
