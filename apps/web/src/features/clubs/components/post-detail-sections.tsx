import {
  Eye,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCircle
} from "lucide-react";

import { PredictionStateBadges } from "@/features/clubs/components/club-feed-tab";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { type RevealedClubPost } from "../api/clubs.js";
import { DeletePostDialog } from "../components/delete-content-dialog.js";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export { CommentsPanel } from "./post-detail-comment-sections.js";

export const PostDetailLoading = () => (
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

export const PostDetailError = ({
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

export const BraveRevealPostPanel = ({
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

export const DeletedPostNotice = () => (
  <Card>
    <CardContent className="flex min-h-56 flex-col justify-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
        <Trash2 className="size-5" />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-primary">Post deleted</h1>
        <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
          This discussion is no longer available in normal LoreSafe views.
        </p>
      </div>
    </CardContent>
  </Card>
);

export const RevealedPostCard = ({
  onDeleted,
  post
}: {
  onDeleted: () => void;
  post: RevealedClubPost;
}) => (
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
      <div className="soft-section-divider flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-faint">
        <span className="flex items-center gap-2">
          <UserCircle className="size-4" />
          {post.author.displayName}
          {post.author.username ? ` / ${post.author.username}` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            {post.counts.commentCount} comments / {post.counts.reactionCount} reactions
          </span>
          {post.permissions.canDelete ? (
            <DeletePostDialog postId={post.id} onDeleted={onDeleted} />
          ) : null}
        </div>
      </div>
    </CardContent>
  </Card>
);
