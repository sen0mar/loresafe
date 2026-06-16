import { type ChangeEvent, type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Send,
  UserCircle
} from "lucide-react";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type Comment,
  type ClubPostCard,
  useCreatePostCommentMutation,
  usePostCommentsQuery,
  usePostQuery
} from "../api/clubs.js";
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
  const postQuery = usePostQuery(postId);
  const commentsEnabled = postQuery.isSuccess;
  const commentsQuery = usePostCommentsQuery(postId, commentsEnabled);

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
            <PostCard post={postQuery.data.post} />
            <CommentsPanel
              comments={commentsQuery.data?.comments ?? []}
              error={commentsQuery.error}
              isError={commentsQuery.isError}
              isLoading={commentsQuery.isPending}
              onRetry={() => void commentsQuery.refetch()}
              post={postQuery.data.post}
              postId={postId}
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

const CommentsPanel = ({
  comments,
  error,
  isError,
  isLoading,
  onRetry,
  post,
  postId
}: {
  comments: Comment[];
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  post: ClubPostCard;
  postId: string;
}) => (
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
        <CommentForm postId={postId} />
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
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentBlock key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const CommentForm = ({ postId }: { postId: string }) => {
  const [values, setValues] = useState<CreateCommentFormValues>({
    body: ""
  });
  const [error, setError] = useState<string | undefined>();
  const createCommentMutation = useCreatePostCommentMutation(postId);
  const isSaving = createCommentMutation.isPending;

  const updateBody = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValues({
      body: event.target.value
    });
    setError(undefined);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createCommentSchema.safeParse(values);

    if (!parseResult.success) {
      setError(parseResult.error.flatten().fieldErrors.body?.[0]);
      return;
    }

    createCommentMutation.mutate(parseResult.data, {
      onSuccess: () => {
        toast.success("Comment posted");
        setValues({
          body: ""
        });
        setError(undefined);
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
        htmlFor="comment-body"
      >
        Add a comment
        <Textarea
          id="comment-body"
          value={values.body}
          onChange={updateBody}
          disabled={isSaving}
          rows={4}
          maxLength={8000}
          placeholder="Share a spoiler-safe thought..."
          aria-invalid={!!error}
          aria-describedby={error ? "comment-body-error" : undefined}
        />
        {error ? (
          <span id="comment-body-error" className="text-xs text-warning">
            {error}
          </span>
        ) : null}
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          <Send />
          {isSaving ? "Posting..." : "Post comment"}
        </Button>
      </div>
    </form>
  );
};

const CommentBlock = ({ comment }: { comment: Comment }) =>
  comment.visibility === "VISIBLE" ? (
    <VisibleCommentBlock comment={comment} />
  ) : (
    <LockedCommentBlock comment={comment} />
  );

const VisibleCommentBlock = ({
  comment
}: {
  comment: Extract<Comment, { visibility: "VISIBLE" }>;
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
  </div>
);

const LockedCommentBlock = ({
  comment
}: {
  comment: Extract<Comment, { visibility: "LOCKED" }>;
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
