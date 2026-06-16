import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { CommentPostRecord } from "./comments.repository.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

export const canViewPostComments = (post: {
  club: {
    visibility: ClubVisibility;
    currentUserRole: string | null;
  };
}) => post.club.visibility === "PUBLIC" || post.club.currentUserRole !== null;

export const canCreatePostComment = (
  post: CommentPostRecord,
  requiredMilestonePosition: number
) =>
  post.club.currentUserRole !== null &&
  !post.club.isCurrentUserBanned &&
  canViewRequiredMilestone({
    mode: post.club.progress.mode,
    currentMilestonePosition: post.club.progress.currentMilestonePosition,
    requiredMilestonePosition
  });
