import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  Eye,
  LockKeyhole,
  MessageCircleReply,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
  UserCircle
} from "lucide-react";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import {
  PostCard,
  PredictionStateBadges
} from "@/features/clubs/components/club-feed-tab";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type Comment,
  type ClubMilestone,
  type ClubPostCard,
  type ClubPostRequiredMilestone,
  type RevealedClubPost,
  type RevealedComment,
  useClubMilestonesQuery,
  useCreatePostCommentMutation,
  usePostCommentsQuery,
  usePostQuery,
  useRevealPostCommentMutation,
  useRevealPostMutation,
  useToggleCommentReactionMutation
} from "../api/clubs.js";
import { ReactionButtonGroup } from "../components/reaction-button-group.js";
import { ReportDialog } from "../components/report-dialog.js";
import {
  DeleteCommentDialog,
  DeletePostDialog
} from "../components/delete-content-dialog.js";
import {
  createCommentSchema,
  type CreateCommentFormValues
} from "../schemas/create-comment.schema.js";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
import type { CommentThread } from "./post-detail-comment-sections.js";
import { CommentForm } from "./post-comment-form.js";

export const CommentThreadBlock = ({
  milestones,
  onCommentDeleted,
  onReply,
  onReplyCancel,
  onRevealComment,
  postId,
  revealedComments,
  revealingCommentId,
  replyParentId,
  thread
}: {
  milestones: ClubMilestone[];
  onCommentDeleted: (commentId: string) => void;
  onReply: (commentId: string) => void;
  onReplyCancel: () => void;
  onRevealComment: (commentId: string) => void;
  postId: string;
  revealedComments: Record<string, RevealedComment>;
  revealingCommentId: string | null;
  replyParentId: string | null;
  thread: CommentThread;
}) => (
  <div className="space-y-3">
    <CommentBlock
      comment={thread.parent}
      canReply={thread.parent.visibility === "VISIBLE"}
      onDeleted={onCommentDeleted}
      onReply={() => onReply(thread.parent.id)}
      onReveal={onRevealComment}
      postId={postId}
      revealedComment={revealedComments[thread.parent.id]}
      revealingCommentId={revealingCommentId}
    />
    {replyParentId === thread.parent.id &&
    thread.parent.visibility === "VISIBLE" ? (
      <div className="soft-thread-divider ml-4 pl-4">
        <CommentForm
          baseMilestone={thread.parent.requiredMilestone}
          label="Reply"
          milestones={milestones}
          onCancel={onReplyCancel}
          onPosted={onReplyCancel}
          parentId={thread.parent.id}
          postId={postId}
          submitLabel="Post reply"
        />
      </div>
    ) : null}
    {thread.replies.length > 0 ? (
      <div className="soft-thread-divider space-y-3 pl-4 md:ml-4">
        {thread.replies.map((reply) => (
          <CommentBlock
            key={reply.id}
            comment={reply}
            canReply={false}
            onDeleted={onCommentDeleted}
            onReveal={onRevealComment}
            postId={postId}
            revealedComment={revealedComments[reply.id]}
            revealingCommentId={revealingCommentId}
          />
        ))}
      </div>
    ) : null}
  </div>
);

const CommentBlock = ({
  canReply,
  comment,
  onDeleted,
  onReply,
  onReveal,
  postId,
  revealedComment,
  revealingCommentId
}: {
  canReply: boolean;
  comment: Comment;
  onDeleted: (commentId: string) => void;
  onReply?: () => void;
  onReveal: (commentId: string) => void;
  postId: string;
  revealedComment?: RevealedComment;
  revealingCommentId: string | null;
}) => {
  if (revealedComment) {
    return (
      <RevealedCommentBlock
        comment={revealedComment}
        onDeleted={onDeleted}
        postId={postId}
      />
    );
  }

  return comment.visibility === "VISIBLE" ? (
    <VisibleCommentBlock
      canReply={canReply}
      comment={comment}
      onDeleted={onDeleted}
      onReply={onReply}
      postId={postId}
    />
  ) : (
    <LockedCommentBlock
      comment={comment}
      isRevealing={revealingCommentId === comment.id}
      onDeleted={onDeleted}
      onReveal={() => onReveal(comment.id)}
      postId={postId}
    />
  );
};

const VisibleCommentBlock = ({
  canReply,
  comment,
  onDeleted,
  onReply,
  postId
}: {
  canReply: boolean;
  comment: Extract<Comment, { visibility: "VISIBLE" }>;
  onDeleted: (commentId: string) => void;
  onReply?: () => void;
  postId: string;
}) => (
  <div className="rounded-xl border border-default bg-subtle p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
      <span className="flex items-center gap-2">
        <UserCircle className="size-4" />
        {comment.author.displayName}
        {comment.author.username ? ` / ${comment.author.username}` : ""}
      </span>
      <span className="flex items-center gap-2">
        <Clock3 className="size-4" />
        {formatDateTime(comment.createdAt)}
      </span>
    </div>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
      {comment.body}
    </p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <CommentReactionButtons comment={comment} postId={postId} />
      <div className="flex flex-wrap items-center gap-2">
        <ReportDialog targetId={comment.id} targetType="COMMENT" />
        {comment.permissions.canDelete ? (
          <DeleteCommentDialog
            commentId={comment.id}
            postId={postId}
            onDeleted={() => onDeleted(comment.id)}
          />
        ) : null}
        {canReply ? (
          <Button type="button" size="sm" variant="secondary" onClick={onReply}>
            <MessageCircleReply />
            Reply
          </Button>
        ) : null}
      </div>
    </div>
  </div>
);

const RevealedCommentBlock = ({
  comment,
  onDeleted,
  postId
}: {
  comment: RevealedComment;
  onDeleted: (commentId: string) => void;
  postId: string;
}) => (
  <div className="rounded-xl border border-strong bg-subtle p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
      <span className="flex items-center gap-2">
        <UserCircle className="size-4" />
        {comment.author.displayName}
        {comment.author.username ? ` / ${comment.author.username}` : ""}
      </span>
      <span className="flex items-center gap-2">
        <Eye className="size-4 text-warning" />
        Revealed once
      </span>
    </div>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
      {comment.body}
    </p>
    <p className="mt-3 flex items-center gap-2 text-xs text-faint">
      <Clock3 className="size-4" />
      {formatDateTime(comment.createdAt)}
    </p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <ReactionButtonGroup
        ariaLabel="Comment reactions"
        disabled
        reactions={comment.counts.reactions}
        onToggle={() => undefined}
      />
      {comment.permissions.canDelete ? (
        <DeleteCommentDialog
          commentId={comment.id}
          postId={postId}
          onDeleted={() => onDeleted(comment.id)}
        />
      ) : null}
    </div>
  </div>
);

const CommentReactionButtons = ({
  comment,
  postId
}: {
  comment: Extract<Comment, { visibility: "VISIBLE" }>;
  postId: string;
}) => {
  const reactionMutation = useToggleCommentReactionMutation(postId, comment.id);

  const handleReactionToggle = (emoji: (typeof comment.counts.reactions)[number]["emoji"]) => {
    if (reactionMutation.isPending) {
      return;
    }

    reactionMutation.mutate(
      {
        emoji,
        active:
          !comment.counts.reactions.find(
            (reaction) => reaction.emoji === emoji
          )?.reactedByMe
      },
      {
        onError: (error) => {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not update reaction. Try again."
          );
        }
      }
    );
  };

  return (
    <ReactionButtonGroup
      ariaLabel="Comment reactions"
      reactions={comment.counts.reactions}
      onToggle={handleReactionToggle}
    />
  );
};

const LockedCommentBlock = ({
  comment,
  isRevealing,
  onDeleted,
  onReveal,
  postId
}: {
  comment: Extract<Comment, { visibility: "LOCKED" }>;
  isRevealing: boolean;
  onDeleted: (commentId: string) => void;
  onReveal: () => void;
  postId: string;
}) => (
  <div className="rounded-xl border border-default bg-inset p-4">
    <span className="flex size-9 items-center justify-center rounded-lg border border-default bg-surface text-info">
      <LockKeyhole className="size-4" />
    </span>
    <h3 className="mt-3 text-sm font-semibold text-primary">Locked comment</h3>
    <p className="mt-1 text-sm leading-6 text-muted">{comment.lockReason}</p>
    <p className="mt-3 flex items-center gap-2 text-xs text-faint">
      <Clock3 className="size-4" />
      {formatDateTime(comment.createdAt)}
    </p>
    <div className="mt-3 rounded-lg border border-default bg-surface p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted">
          Brave mode can reveal this comment for the current view only.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {comment.permissions.canDelete ? (
            <DeleteCommentDialog
              commentId={comment.id}
              postId={postId}
              onDeleted={() => onDeleted(comment.id)}
            />
          ) : null}
          <Button
            className="w-full sm:w-fit"
            type="button"
            size="sm"
            variant="secondary"
            disabled={isRevealing}
            onClick={onReveal}
          >
            <Eye />
            {isRevealing ? "Revealing..." : "Reveal once"}
          </Button>
        </div>
      </div>
    </div>
  </div>
);

export const CommentsLoading = () => (
  <div className="space-y-3">
    {Array.from({ length: 2 }).map((_, index) => (
      <div
        key={index}
        className="rounded-xl border border-default bg-subtle p-4"
      >
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
    ))}
  </div>
);

export const CommentsEmpty = () => (
  <div className="rounded-xl border border-default bg-subtle p-4">
    <MessageSquareText className="size-7 text-faint" />
    <h3 className="mt-3 text-sm font-semibold text-primary">
      No comments yet
    </h3>
    <p className="mt-1 text-sm leading-6 text-muted">
      Be the first to continue this discussion.
    </p>
  </div>
);

export const CommentsError = ({
  error,
  onRetry
}: {
  error: Error | null;
  onRetry: () => void;
}) => (
  <div className="rounded-xl border border-default bg-inset p-4">
    <h3 className="text-sm font-semibold text-primary">
      Could not load comments
    </h3>
    <p className="mt-1 text-sm leading-6 text-muted">
      {error instanceof ApiError ? error.message : "Refresh and try again."}
    </p>
    <Button className="mt-3" type="button" variant="secondary" onClick={onRetry}>
      <RefreshCw />
      Retry
    </Button>
  </div>
);
