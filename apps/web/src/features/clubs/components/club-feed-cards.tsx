import { Link } from "react-router-dom";
import {
  Clock3,
  Image,
  LockKeyhole,
  LockKeyholeOpen,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  UserCircle
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import {
  type ClubFeedTab as ClubFeedTabValue,
  type ClubPostCounts,
  type ClubPostCard,
  type ClubPostPrediction,
  postReactionEmojis,
  useTogglePostReactionMutation
} from "../api/clubs.js";
import { ReactionButtonGroup } from "./reaction-button-group.js";
import { ReportDialog } from "./report-dialog.js";
import { DeletePostDialog } from "./delete-content-dialog.js";
import { postTypeLabels } from "../lib/post-types.js";
import { formatCount, formatShortDateTime } from "@/shared/lib/formatters";

type PostDetailLinkState = {
  returnLabel: string;
  returnTo: string;
};

const predictionStatusLabels: Record<ClubPostPrediction["status"], string> = {
  UNRESOLVED: "Unresolved",
  CORRECT: "Correct",
  WRONG: "Wrong",
  PARTIAL: "Partial"
};

export const PostCard = ({
  linked = false,
  isUnlocking = false,
  onDeleted,
  onOptimisticReaction,
  onReactionReconciled,
  onReactionRollback,
  post,
  returnState
}: {
  linked?: boolean;
  isUnlocking?: boolean;
  onDeleted?: (postId: string) => void;
  onOptimisticReaction?: (post: ClubPostCard) => void;
  onReactionReconciled?: (post: ClubPostCard) => void;
  onReactionRollback?: (post: ClubPostCard | null) => void;
  post: ClubPostCard;
  returnState?: PostDetailLinkState;
}) => {
  return post.visibility === "VISIBLE" ? (
    <VisiblePostCard
      linked={linked}
      isUnlocking={isUnlocking}
      onDeleted={onDeleted}
      onOptimisticReaction={onOptimisticReaction}
      onReactionReconciled={onReactionReconciled}
      onReactionRollback={onReactionRollback}
      post={post}
      returnState={returnState}
    />
  ) : (
    <LockedPostCard
      linked={linked}
      onDeleted={onDeleted}
      post={post}
      returnState={returnState}
    />
  );
};

const VisiblePostCard = ({
  isUnlocking,
  linked,
  onDeleted,
  onOptimisticReaction,
  onReactionReconciled,
  onReactionRollback,
  post,
  returnState
}: {
  isUnlocking: boolean;
  linked: boolean;
  onDeleted?: (postId: string) => void;
  onOptimisticReaction?: (post: ClubPostCard) => void;
  onReactionReconciled?: (post: ClubPostCard) => void;
  onReactionRollback?: (post: ClubPostCard | null) => void;
  post: Extract<ClubPostCard, { visibility: "VISIBLE" }>;
  returnState?: PostDetailLinkState;
}) => (
  <Card
    className={cn(
      linked
        ? "group relative transition-colors hover:border-strong focus-within:border-strong"
        : undefined,
      isUnlocking ? "post-unlock-card" : undefined
    )}
  >
    <CardContent
      className={cn(
        "space-y-4 p-4",
        isUnlocking ? "post-unlock-content" : undefined
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PostMetaRow post={post} />
        <span className="flex items-center gap-2 text-xs text-faint">
          <UserCircle className="size-4" />
          {post.author.displayName}
          {post.author.username ? ` / ${post.author.username}` : ""}
        </span>
      </div>
      <div className="space-y-2">
        <h2 className="text-base font-semibold tracking-normal text-primary">
          {linked ? (
            <Link
              className="rounded-md transition-colors before:absolute before:inset-0 before:rounded-xl before:content-[''] group-hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:before:ring-2 focus-visible:before:ring-brand"
              to={`/app/posts/${post.id}`}
              state={returnState}
            >
              {post.title}
            </Link>
          ) : (
            post.title
          )}
        </h2>
        <p className="text-sm leading-6 text-muted">{post.bodyPreview}</p>
        {post.media ? <PostMediaPreview media={post.media} /> : null}
        {post.prediction ? (
          <PredictionStateBadges prediction={post.prediction} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-inset px-3 py-2">
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <PostReactionButtons
            counts={post.counts}
            onOptimisticReaction={onOptimisticReaction}
            onReactionReconciled={onReactionReconciled}
            onReactionRollback={onReactionRollback}
            postId={post.id}
          />
          <PostCounts post={post} />
        </div>
        <div className="relative z-10 flex items-center gap-1">
          <ReportDialog targetId={post.id} targetType="POST" />
          {post.permissions?.canDelete === true ? (
            <DeletePostDialog
              postId={post.id}
              onDeleted={() => onDeleted?.(post.id)}
            />
          ) : null}
        </div>
      </div>
    </CardContent>
    {isUnlocking ? <PostUnlockOverlay /> : null}
  </Card>
);

const PostUnlockOverlay = () => (
  <div aria-hidden="true" className="post-unlock-overlay">
    <span className="post-unlock-icon">
      <LockKeyholeOpen className="size-5" />
    </span>
  </div>
);

const PostMediaPreview = ({
  media
}: {
  media: NonNullable<Extract<ClubPostCard, { visibility: "VISIBLE" }>["media"]>;
}) => (
  <figure className="overflow-hidden rounded-lg border border-subtle bg-inset">
    <img
      src={media.url}
      alt=""
      className="max-h-96 w-full object-cover"
      loading="lazy"
    />
    <figcaption className="flex items-center gap-2 px-3 py-2 text-xs text-faint">
      <Image className="size-3.5" />
      Post image
    </figcaption>
  </figure>
);

export const PredictionStateBadges = ({
  prediction
}: {
  prediction: ClubPostPrediction;
}) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
    <Badge variant="secondary">
      Prediction {predictionStatusLabels[prediction.status]}
    </Badge>
    <Badge variant="outline">
      Reveal milestone {prediction.revealMilestone.position}:{" "}
      {prediction.revealMilestone.label}
    </Badge>
  </div>
);

const LockedPostCard = ({
  linked,
  onDeleted,
  post,
  returnState
}: {
  linked: boolean;
  onDeleted?: (postId: string) => void;
  post: Extract<ClubPostCard, { visibility: "LOCKED" }>;
  returnState?: PostDetailLinkState;
}) => (
  <Card
    className={
      linked
        ? "group relative transition-colors hover:border-strong focus-within:border-strong"
        : undefined
    }
  >
    <CardContent className="space-y-4 p-4">
      <PostMetaRow post={post} />
      <div className="rounded-lg border border-default bg-inset p-4">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-surface text-info">
          <LockKeyhole className="size-5" />
        </span>
        <h2 className="mt-3 text-base font-semibold text-primary">
          {linked ? (
            <Link
              className="rounded-md transition-colors before:absolute before:inset-0 before:rounded-xl before:content-[''] group-hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:before:ring-2 focus-visible:before:ring-brand"
              to={`/app/posts/${post.id}`}
              state={returnState}
            >
              Locked discussion
            </Link>
          ) : (
            "Locked discussion"
          )}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">{post.lockReason}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-inset px-3 py-2">
        <span className="flex items-center gap-2 text-xs text-faint">
          <Clock3 className="size-4" />
          {formatShortDateTime(post.createdAt)}
        </span>
        <div className="relative z-10 flex flex-1 flex-wrap items-center justify-end gap-3">
          <PostCounts post={post} />
          {post.permissions?.canDelete === true ? (
            <div className="flex items-center gap-1">
              <DeletePostDialog
                postId={post.id}
                onDeleted={() => onDeleted?.(post.id)}
              />
            </div>
          ) : null}
        </div>
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
    <span>{formatShortDateTime(post.createdAt)}</span>
  </div>
);

const PostCounts = ({ post }: { post: ClubPostCard }) => (
  <span className="text-xs text-faint">
    {formatCount(post.counts.commentCount)} comments /{" "}
    {formatCount(post.counts.reactionCount)} reactions
  </span>
);

export const PostReactionButtons = ({
  counts,
  onOptimisticReaction,
  onReactionReconciled,
  onReactionRollback,
  postId
}: {
  counts: ClubPostCounts;
  onOptimisticReaction?: (post: ClubPostCard) => void;
  onReactionReconciled?: (post: ClubPostCard) => void;
  onReactionRollback?: (post: ClubPostCard | null) => void;
  postId: string;
}) => {
  const reactionMutation = useTogglePostReactionMutation(postId, {
    onOptimisticPost: onOptimisticReaction,
    onReconciledPost: onReactionReconciled,
    onRollbackPost: onReactionRollback
  });

  const handleReactionToggle =
    (emoji: (typeof postReactionEmojis)[number]) => () => {
      if (reactionMutation.isPending) {
        return;
      }

      reactionMutation.mutate(
        {
          emoji,
          active: !counts.reactions.find((reaction) => reaction.emoji === emoji)
            ?.reactedByMe
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
      ariaLabel="Reactions"
      reactions={counts.reactions}
      onToggle={(emoji) => handleReactionToggle(emoji)()}
    />
  );
};

export const FeedLoading = () => (
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

const emptyStateByTab: Record<
  ClubFeedTabValue,
  { title: string; body: string }
> = {
  safe: {
    title: "No safe posts yet",
    body: "Discussions at your current progress will appear here."
  },
  unanswered: {
    title: "No unanswered posts",
    body: "Every discussion has a reply right now."
  },
  locked: {
    title: "No locked posts",
    body: "Future discussions will appear here when they are beyond your current progress."
  },
  all: {
    title: "No posts yet",
    body: "Club discussions will appear here after posts are added."
  },
  "my-posts": {
    title: "No posts from you yet",
    body: "Posts you create in this club will appear here."
  }
};

export const FeedEmpty = ({ activeTab }: { activeTab: ClubFeedTabValue }) => {
  const emptyState = emptyStateByTab[activeTab];

  return (
    <Card>
      <CardContent className="flex min-h-48 flex-col justify-center gap-2">
        <MessageSquareText className="size-8 text-faint" />
        <h2 className="text-base font-semibold text-primary">
          {emptyState.title}
        </h2>
        <p className="max-w-lg text-sm leading-6 text-muted">
          {emptyState.body}
        </p>
      </CardContent>
    </Card>
  );
};

export const FeedError = ({
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
