import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { CommentPostRecord } from "./comments.repository.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export const canViewPostComments = (post: {
  club: {
    visibility: ClubVisibility;
    currentUserRole: string | null;
    isCurrentUserBanned: boolean;
  };
}) =>
  !post.club.isCurrentUserBanned &&
  (post.club.visibility === "PUBLIC" || post.club.currentUserRole !== null);

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

export const canToggleCommentReaction = (post: CommentPostRecord) =>
  post.club.currentUserRole !== null && !post.club.isCurrentUserBanned;

export const canDeleteComment = ({
  authorId,
  currentUserId,
  currentUserRole
}: {
  authorId: string;
  currentUserId: string;
  currentUserRole: ClubMembershipRole | null;
}) =>
  authorId === currentUserId ||
  currentUserRole === "OWNER" ||
  currentUserRole === "MODERATOR";
