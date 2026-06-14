import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  UserCircle
} from "lucide-react";

import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import {
  type Club,
  type ClubPostCard,
  type PostType,
  useClubPostsQuery
} from "../api/clubs.js";

type ClubFeedTabProps = {
  club: Club;
};

const postTypeLabels: Record<PostType, string> = {
  DISCUSSION: "Discussion",
  QUESTION: "Question",
  THEORY: "Theory",
  PREDICTION: "Prediction",
  POLL: "Poll",
  REACTION: "Reaction",
  REVIEW: "Review",
  IMAGE_MEME: "Image/meme",
  QUOTE_COMMENTARY: "Quote",
  JUST_REACHED: "Just reached"
};

const countFormatter = new Intl.NumberFormat();

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export const ClubFeedTab = ({ club }: ClubFeedTabProps) => {
  const [page, setPage] = useState(1);
  const postsQuery = useClubPostsQuery(club.slug, page);

  useEffect(() => {
    setPage(1);
  }, [club.slug]);

  if (postsQuery.isPending) {
    return <FeedLoading />;
  }

  if (postsQuery.isError) {
    return (
      <FeedError
        error={postsQuery.error}
        onRetry={() => void postsQuery.refetch()}
      />
    );
  }

  const { posts, pagination } = postsQuery.data;

  if (posts.length === 0) {
    return <FeedEmpty />;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {pagination.pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface p-3">
          <p className="text-sm text-muted">
            Page {pagination.page} of {pagination.pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1 || postsQuery.isFetching}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                pagination.page >= pagination.pageCount ||
                postsQuery.isFetching
              }
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const PostCard = ({ post }: { post: ClubPostCard }) =>
  post.visibility === "VISIBLE" ? (
    <VisiblePostCard post={post} />
  ) : (
    <LockedPostCard post={post} />
  );

const VisiblePostCard = ({
  post
}: {
  post: Extract<ClubPostCard, { visibility: "VISIBLE" }>;
}) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <PostMetaRow post={post} />
      <div className="space-y-2">
        <h2 className="text-base font-semibold tracking-normal text-primary">
          {post.title}
        </h2>
        <p className="text-sm leading-6 text-muted">{post.bodyPreview}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3 text-xs text-faint">
        <span className="flex items-center gap-2">
          <UserCircle className="size-4" />
          {post.author.displayName}
          {post.author.username ? ` / ${post.author.username}` : ""}
        </span>
        <PostCounts post={post} />
      </div>
    </CardContent>
  </Card>
);

const LockedPostCard = ({
  post
}: {
  post: Extract<ClubPostCard, { visibility: "LOCKED" }>;
}) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <PostMetaRow post={post} />
      <div className="rounded-lg border border-default bg-inset p-4">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-surface text-info">
          <LockKeyhole className="size-5" />
        </span>
        <h2 className="mt-3 text-base font-semibold text-primary">
          Locked discussion
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">{post.lockReason}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3 text-xs text-faint">
        <span className="flex items-center gap-2">
          <Clock3 className="size-4" />
          {formatDateTime(post.createdAt)}
        </span>
        <PostCounts post={post} />
      </div>
    </CardContent>
  </Card>
);

const PostMetaRow = ({ post }: { post: ClubPostCard }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
    <Badge variant={post.visibility === "VISIBLE" ? "default" : "secondary"}>
      {postTypeLabels[post.type]}
    </Badge>
    <Badge variant="outline">
      Milestone {post.requiredMilestone.position}:{" "}
      {post.requiredMilestone.label}
    </Badge>
    {post.visibility === "LOCKED" ? (
      <Badge variant="secondary">
        <LockKeyhole className="size-3" />
        Locked
      </Badge>
    ) : null}
    <span>{formatDateTime(post.createdAt)}</span>
  </div>
);

const PostCounts = ({ post }: { post: ClubPostCard }) => (
  <span>
    {countFormatter.format(post.counts.commentCount)} comments /{" "}
    {countFormatter.format(post.counts.reactionCount)} reactions
  </span>
);

const FeedLoading = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index}>
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
    ))}
  </div>
);

const FeedEmpty = () => (
  <Card>
    <CardContent className="flex min-h-48 flex-col justify-center gap-2">
      <MessageSquareText className="size-8 text-faint" />
      <h2 className="text-base font-semibold text-primary">No posts yet</h2>
      <p className="max-w-lg text-sm leading-6 text-muted">
        Club discussions will appear here after posts are added.
      </p>
    </CardContent>
  </Card>
);

const FeedError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isDenied =
    error instanceof ApiError &&
    (error.statusCode === 403 || error.statusCode === 404);

  return (
    <Card>
      <CardContent className="flex min-h-48 flex-col justify-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
          {isDenied ? (
            <LockKeyhole className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>
        <div>
          <h2 className="text-base font-semibold text-primary">
            {isDenied ? "Feed unavailable" : "Could not load feed"}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
            {isDenied
              ? "This club feed is unavailable from your account."
              : "Refresh the feed and try again."}
          </p>
        </div>
        {isDenied ? null : (
          <Button className="w-fit" variant="secondary" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
