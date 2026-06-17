import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";
import { Link, useParams } from "react-router-dom";
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

export const PostDetailPage = () => {
  const { postId = "" } = useParams();
  const [revealedPost, setRevealedPost] = useState<RevealedClubPost | null>(
    null
  );
  const [revealedComments, setRevealedComments] = useState<
    Record<string, RevealedComment>
  >({});
  const postQuery = usePostQuery(postId);
  const commentsEnabled = postQuery.isSuccess;
  const commentsQuery = usePostCommentsQuery(postId, commentsEnabled);
  const comments =
    commentsQuery.data?.pages.flatMap((page) => page.comments) ?? [];
  const revealPostMutation = useRevealPostMutation(postId);
  const revealCommentMutation = useRevealPostCommentMutation(postId);

  useEffect(() => {
    setRevealedPost(null);
    setRevealedComments({});
  }, [postId]);

  const handleRevealPost = () => {
    revealPostMutation.mutate(undefined, {
      onSuccess: (response) => {
        setRevealedPost(response.post);
        toast.warning("Discussion revealed for this view");
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not reveal this discussion. Try again."
        );
      }
    });
  };

  const handleRevealComment = (commentId: string) => {
    revealCommentMutation.mutate(commentId, {
      onSuccess: (response) => {
        setRevealedComments((currentComments) => ({
          ...currentComments,
          [response.comment.id]: response.comment
        }));
        toast.warning("Comment revealed for this view");
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not reveal this comment. Try again."
        );
      }
    });
  };

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/explore">
            <ArrowLeft />
            Explore
          </Link>
        </Button>

        {postQuery.isPending ? (
          <PostDetailLoading />
        ) : postQuery.isError ? (
          <PostDetailError
            error={postQuery.error}
            onRetry={() => void postQuery.refetch()}
          />
        ) : (
          <>
            {revealedPost ? (
              <RevealedPostCard post={revealedPost} />
            ) : (
              <>
                <PostCard post={postQuery.data.post} />
                {postQuery.data.post.visibility === "LOCKED" ? (
                  <BraveRevealPostPanel
                    isRevealing={revealPostMutation.isPending}
                    onReveal={handleRevealPost}
                  />
                ) : null}
              </>
            )}
            <CommentsPanel
              clubSlug={postQuery.data.club.slug}
              comments={comments}
              error={commentsQuery.error}
              hasNextPage={commentsQuery.hasNextPage}
              isError={commentsQuery.isError}
              isFetchingNextPage={commentsQuery.isFetchingNextPage}
              isLoading={commentsQuery.isPending}
              onLoadMore={() => void commentsQuery.fetchNextPage()}
              onRetry={() => void commentsQuery.refetch()}
              onRevealComment={handleRevealComment}
              post={postQuery.data.post}
              postId={postId}
              revealedComments={revealedComments}
              revealingCommentId={
                revealCommentMutation.isPending
                  ? revealCommentMutation.variables
                  : null
              }
            />
          </>
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const PostDetailLoading = () => (
  <Card>
    <CardHeader className="space-y-3">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-4 w-36" />
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

const PostDetailError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isNotFound = error instanceof ApiError && error.statusCode === 404;

  return (
    <Card>
      <CardContent className="flex min-h-64 flex-col justify-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
          <LockKeyhole className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-primary">
            {isNotFound ? "Post not found" : "Could not load post"}
          </h1>
          <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
            {isNotFound
              ? "This post is unavailable from your account."
              : "Refresh the post and try again."}
          </p>
        </div>
        {isNotFound ? null : (
          <Button className="w-fit" variant="secondary" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const BraveRevealPostPanel = ({
  isRevealing,
  onReveal
}: {
  isRevealing: boolean;
  onReveal: () => void;
}) => (
  <Card className="border-strong bg-inset">
    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-default bg-surface text-warning">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-primary">
            Brave reveal
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            This will show locked post content for this view only.
          </p>
        </div>
      </div>
      <Button
        className="w-full sm:w-fit"
        type="button"
        variant="secondary"
        disabled={isRevealing}
        onClick={onReveal}
      >
        <Eye />
        {isRevealing ? "Revealing..." : "Reveal once"}
      </Button>
    </CardContent>
  </Card>
);

const RevealedPostCard = ({ post }: { post: RevealedClubPost }) => (
  <Card className="border-strong">
    <CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
        <span className="rounded-md border border-default bg-active px-2 py-1 text-warning">
          Revealed once
        </span>
        <span>
          Milestone {post.requiredMilestone.position}:{" "}
          {post.requiredMilestone.label}
        </span>
        <span>{formatDateTime(post.createdAt)}</span>
      </div>
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-primary">{post.title}</h1>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
          {post.body}
        </p>
        {post.prediction ? (
          <PredictionStateBadges prediction={post.prediction} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3 text-xs text-faint">
        <span className="flex items-center gap-2">
          <UserCircle className="size-4" />
          {post.author.displayName}
          {post.author.username ? ` / ${post.author.username}` : ""}
        </span>
        <span>
          {post.counts.commentCount} comments / {post.counts.reactionCount} reactions
        </span>
      </div>
    </CardContent>
  </Card>
);

const CommentsPanel = ({
  clubSlug,
  comments,
  error,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  onLoadMore,
  onRevealComment,
  onRetry,
  post,
  postId,
  revealedComments,
  revealingCommentId
}: {
  clubSlug: string;
  comments: Comment[];
  error: Error | null;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onRevealComment: (commentId: string) => void;
  onRetry: () => void;
  post: ClubPostCard;
  postId: string;
  revealedComments: Record<string, RevealedComment>;
  revealingCommentId: string | null;
}) => {
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const threads = useMemo(() => buildCommentThreads(comments), [comments]);
  const milestonesQuery = useClubMilestonesQuery(
    clubSlug,
    1,
    post.visibility === "VISIBLE"
  );
  const milestones = milestonesQuery.data?.milestones ?? [];

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
            <MessageSquareText className="size-5 text-brand" />
            Comments
          </h2>
          <span className="text-xs text-faint">
            {post.counts.commentCount} total
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {post.visibility === "VISIBLE" ? (
          <CommentForm
            baseMilestone={post.requiredMilestone}
            label="Add a comment"
            milestones={milestones}
            milestoneHelp={
              milestonesQuery.isError
                ? "Could not load advanced milestone options."
                : undefined
            }
            postId={postId}
            submitLabel="Post comment"
          />
        ) : (
          <div className="rounded-lg border border-default bg-inset p-4 text-sm text-muted">
            Reach the required milestone to join this discussion.
          </div>
        )}

        {isLoading ? (
          <CommentsLoading />
        ) : isError ? (
          <CommentsError error={error} onRetry={onRetry} />
        ) : comments.length === 0 ? (
          <CommentsEmpty />
        ) : (
          <>
            <div className="space-y-3">
              {threads.map((thread) => (
                <CommentThreadBlock
                  key={thread.parent.id}
                  milestones={milestones}
                  onReply={(commentId) => setReplyParentId(commentId)}
                  onReplyCancel={() => setReplyParentId(null)}
                  onRevealComment={onRevealComment}
                  postId={postId}
                  revealedComments={revealedComments}
                  revealingCommentId={revealingCommentId}
                  replyParentId={replyParentId}
                  thread={thread}
                />
              ))}
            </div>
            {hasNextPage ? (
              <div className="flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  {comments.length} comments loaded
                </p>
                <Button
                  className="w-full sm:w-fit"
                  type="button"
                  variant="secondary"
                  disabled={isFetchingNextPage}
                  onClick={onLoadMore}
                >
                  <ChevronDown />
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

type CommentThread = {
  parent: Comment;
  replies: Comment[];
};

const buildCommentThreads = (comments: Comment[]): CommentThread[] => {
  const commentIds = new Set(comments.map((comment) => comment.id));
  const repliesByParent = new Map<string, Comment[]>();
  const parents: Comment[] = [];

  for (const comment of comments) {
    if (comment.parentId && commentIds.has(comment.parentId)) {
      repliesByParent.set(comment.parentId, [
        ...(repliesByParent.get(comment.parentId) ?? []),
        comment
      ]);
      continue;
    }

    parents.push(comment);
  }

  return parents.map((parent) => ({
    parent,
    replies: repliesByParent.get(parent.id) ?? []
  }));
};

const CommentForm = ({
  baseMilestone,
  label,
  milestoneHelp,
  milestones,
  onCancel,
  onPosted,
  parentId,
  postId,
  submitLabel
}: {
  baseMilestone: ClubPostRequiredMilestone;
  label: string;
  milestoneHelp?: string;
  milestones: ClubMilestone[];
  onCancel?: () => void;
  onPosted?: () => void;
  parentId?: string;
  postId: string;
  submitLabel: string;
}) => {
  const [body, setBody] = useState("");
  const [requiredMilestoneId, setRequiredMilestoneId] = useState(
    baseMilestone.id
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [errors, setErrors] = useState<{
    body?: string;
    requiredMilestoneId?: string;
  }>({});
  const createCommentMutation = useCreatePostCommentMutation(postId);
  const isSaving = createCommentMutation.isPending;
  const bodyId = parentId ? `reply-${parentId}-body` : "comment-body";
  const milestoneId = parentId
    ? `reply-${parentId}-required-milestone`
    : "comment-required-milestone";
  const eligibleMilestones = milestones.filter(
    (milestone) => milestone.position >= baseMilestone.position
  );
  const milestoneOptions = eligibleMilestones.some(
    (milestone) => milestone.id === baseMilestone.id
  )
    ? eligibleMilestones
    : [
        {
          id: baseMilestone.id,
          position: baseMilestone.position,
          safeTitle: baseMilestone.label,
          fullTitle: null,
          description: null,
          spoilerName: false,
          isFullTitleHidden: false
        },
        ...eligibleMilestones
      ];

  const updateBody = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value);
    setErrors((currentErrors) => ({
      ...currentErrors,
      body: undefined
    }));
  };

  const updateMilestone = (event: ChangeEvent<HTMLSelectElement>) => {
    setRequiredMilestoneId(event.target.value);
    setErrors((currentErrors) => ({
      ...currentErrors,
      requiredMilestoneId: undefined
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const values: CreateCommentFormValues = {
      body,
      parentId,
      requiredMilestoneId:
        requiredMilestoneId === baseMilestone.id
          ? undefined
          : requiredMilestoneId
    };
    const parseResult = createCommentSchema.safeParse(values);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      setErrors({
        body: fieldErrors.body?.[0],
        requiredMilestoneId: fieldErrors.requiredMilestoneId?.[0]
      });
      return;
    }

    createCommentMutation.mutate(parseResult.data, {
      onSuccess: () => {
        toast.success("Comment posted");
        setBody("");
        setRequiredMilestoneId(baseMilestone.id);
        setErrors({});
        onPosted?.();
      },
      onError: (mutationError) => {
        toast.error(
          mutationError instanceof ApiError
            ? mutationError.message
            : "Could not post comment. Try again."
        );
      }
    });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label
        className="grid gap-2 text-sm font-medium text-secondary"
        htmlFor={bodyId}
      >
        {label}
        <Textarea
          id={bodyId}
          value={body}
          onChange={updateBody}
          disabled={isSaving}
          rows={parentId ? 3 : 4}
          maxLength={8000}
          placeholder="Share a spoiler-safe thought..."
          aria-invalid={!!errors.body}
          aria-describedby={errors.body ? `${bodyId}-error` : undefined}
        />
        {errors.body ? (
          <span id={`${bodyId}-error`} className="text-xs text-warning">
            {errors.body}
          </span>
        ) : null}
      </label>
      <div className="space-y-3 rounded-lg border border-default bg-inset p-3">
        <button
          className="flex w-full items-center justify-between gap-3 text-left text-xs font-medium text-secondary transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          type="button"
          onClick={() => setIsAdvancedOpen((isOpen) => !isOpen)}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-brand" />
            Advanced comment options
          </span>
          <span className="text-faint">
            Milestone {getSelectedMilestoneLabel(requiredMilestoneId, milestoneOptions)}
          </span>
        </button>
        {isAdvancedOpen ? (
          <label
            className="grid gap-2 text-xs font-medium text-secondary"
            htmlFor={milestoneId}
          >
            Requires later milestone
            <select
              id={milestoneId}
              className="h-10 rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
              value={requiredMilestoneId}
              onChange={updateMilestone}
              disabled={isSaving}
              aria-invalid={!!errors.requiredMilestoneId}
              aria-describedby={
                errors.requiredMilestoneId
                  ? `${milestoneId}-error`
                  : milestoneHelp
                    ? `${milestoneId}-help`
                    : undefined
              }
            >
              {milestoneOptions.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.position}. {milestone.safeTitle}
                </option>
              ))}
            </select>
            {errors.requiredMilestoneId ? (
              <span id={`${milestoneId}-error`} className="text-warning">
                {errors.requiredMilestoneId}
              </span>
            ) : milestoneHelp ? (
              <span id={`${milestoneId}-help`} className="text-faint">
                {milestoneHelp}
              </span>
            ) : null}
          </label>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X />
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSaving}>
          <Send />
          {isSaving ? "Posting..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

const getSelectedMilestoneLabel = (
  selectedMilestoneId: string,
  milestones: ClubMilestone[]
) =>
  milestones.find((milestone) => milestone.id === selectedMilestoneId)
    ?.position ?? "";

const CommentThreadBlock = ({
  milestones,
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
      onReply={() => onReply(thread.parent.id)}
      onReveal={onRevealComment}
      postId={postId}
      revealedComment={revealedComments[thread.parent.id]}
      revealingCommentId={revealingCommentId}
    />
    {replyParentId === thread.parent.id &&
    thread.parent.visibility === "VISIBLE" ? (
      <div className="ml-4 border-l border-subtle pl-4">
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
      <div className="space-y-3 border-l border-subtle pl-4 md:ml-4">
        {thread.replies.map((reply) => (
          <CommentBlock
            key={reply.id}
            comment={reply}
            canReply={false}
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
  onReply,
  onReveal,
  postId,
  revealedComment,
  revealingCommentId
}: {
  canReply: boolean;
  comment: Comment;
  onReply?: () => void;
  onReveal: (commentId: string) => void;
  postId: string;
  revealedComment?: RevealedComment;
  revealingCommentId: string | null;
}) => {
  if (revealedComment) {
    return <RevealedCommentBlock comment={revealedComment} />;
  }

  return comment.visibility === "VISIBLE" ? (
    <VisibleCommentBlock
      canReply={canReply}
      comment={comment}
      onReply={onReply}
      postId={postId}
    />
  ) : (
    <LockedCommentBlock
      comment={comment}
      isRevealing={revealingCommentId === comment.id}
      onReveal={() => onReveal(comment.id)}
    />
  );
};

const VisibleCommentBlock = ({
  canReply,
  comment,
  onReply,
  postId
}: {
  canReply: boolean;
  comment: Extract<Comment, { visibility: "VISIBLE" }>;
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
  comment
}: {
  comment: RevealedComment;
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
    <div className="mt-3">
      <ReactionButtonGroup
        ariaLabel="Comment reactions"
        disabled
        reactions={comment.counts.reactions}
        onToggle={() => undefined}
      />
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
    reactionMutation.mutate(
      {
        emoji
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
      disabled={reactionMutation.isPending}
      reactions={comment.counts.reactions}
      onToggle={handleReactionToggle}
    />
  );
};

const LockedCommentBlock = ({
  comment,
  isRevealing,
  onReveal
}: {
  comment: Extract<Comment, { visibility: "LOCKED" }>;
  isRevealing: boolean;
  onReveal: () => void;
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
);

const CommentsLoading = () => (
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

const CommentsEmpty = () => (
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

const CommentsError = ({
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
