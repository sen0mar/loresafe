import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState
} from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Clock3,
  Image,
  LockKeyhole,
  MessageSquareText,
  PlusCircle,
  RefreshCw,
  Sparkles,
  UserCircle
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type Club,
  type ClubFeedTab as ClubFeedTabValue,
  type ClubMilestone,
  type ClubPostCounts,
  type ClubPostCard,
  type ClubPostPrediction,
  type PostType,
  postReactionEmojis,
  useClubMilestonesQuery,
  useClubPostsInfiniteQuery,
  useCreateClubPostMutation,
  useTogglePostReactionMutation
} from "../api/clubs.js";
import {
  createPostSchema,
  type CreatePostFormValues
} from "../schemas/create-post.schema.js";
import { ReactionButtonGroup } from "./reaction-button-group.js";
import { ReportDialog } from "./report-dialog.js";
import { PostImageUploadField } from "./post-image-upload-field.js";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

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

const predictionStatusLabels: Record<ClubPostPrediction["status"], string> = {
  UNRESOLVED: "Unresolved",
  CORRECT: "Correct",
  WRONG: "Wrong",
  PARTIAL: "Partial"
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const getDefaultPostValues = (): CreatePostFormValues => ({
  title: "",
  body: "",
  type: "DISCUSSION",
  requiredMilestoneId: "",
  mediaAssetId: undefined
});

const formatMilestoneOption = (milestone: ClubMilestone) =>
  `${milestone.position}. ${milestone.fullTitle ?? milestone.safeTitle}`;

const feedTabs: Array<{ value: ClubFeedTabValue; label: string }> = [
  {
    value: "safe",
    label: "Safe"
  },
  {
    value: "unanswered",
    label: "Unanswered"
  },
  {
    value: "locked",
    label: "Locked"
  },
  {
    value: "all",
    label: "All"
  },
  {
    value: "my-posts",
    label: "My posts"
  }
];

export const ClubFeedTab = ({ club }: ClubFeedTabProps) => {
  const [activeTab, setActiveTab] = useState<ClubFeedTabValue>("all");
  const postsQuery = useClubPostsInfiniteQuery(club.slug, activeTab);
  const createPostAction = club.membership.isMember ? (
    <CreatePostDialog club={club} />
  ) : null;

  if (postsQuery.isPending) {
    return (
      <div className="space-y-3">
        <FeedToolbar
          action={createPostAction}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <FeedLoading />
      </div>
    );
  }

  if (postsQuery.isError) {
    return (
      <FeedError
        error={postsQuery.error}
        onRetry={() => void postsQuery.refetch()}
      />
    );
  }

  const posts = postsQuery.data.pages.flatMap((page) => page.posts);

  return (
    <div className="space-y-3">
      <FeedToolbar
        action={createPostAction}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {posts.length === 0 ? (
        <FeedEmpty activeTab={activeTab} />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} linked />
          ))}
        </div>
      )}

      {postsQuery.hasNextPage ? (
        <div className="flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {countFormatter.format(posts.length)} loaded
          </p>
          <Button
            className="w-full sm:w-fit"
            type="button"
            variant="secondary"
            size="sm"
            disabled={postsQuery.isFetchingNextPage}
            onClick={() => void postsQuery.fetchNextPage()}
          >
            <ChevronDown />
            {postsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const FeedToolbar = ({
  action,
  activeTab,
  onTabChange
}: {
  action: ReactNode;
  activeTab: ClubFeedTabValue;
  onTabChange: (tab: ClubFeedTabValue) => void;
}) => (
  <div className="flex min-h-10 min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <Tabs
      className="min-w-0 max-w-full"
      value={activeTab}
      onValueChange={(value) => onTabChange(value as ClubFeedTabValue)}
    >
      <TabsList className="w-full sm:w-fit">
        {feedTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
    <div className="flex shrink-0">{action}</div>
  </div>
);

const CreatePostDialog = ({
  club
}: {
  club: Club;
}) => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreatePostFormValues>(
    getDefaultPostValues()
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CreatePostFormValues, string>>
  >({});
  const [hasPendingImage, setHasPendingImage] = useState(false);
  const milestonesQuery = useClubMilestonesQuery(club.slug, 1, open);
  const createPostMutation = useCreateClubPostMutation(club.slug);
  const milestones = milestonesQuery.data?.milestones ?? [];
  const isSaving = createPostMutation.isPending;
  const canSubmit =
    !isSaving &&
    !hasPendingImage &&
    !milestonesQuery.isPending &&
    milestones.length > 0;
  const selectedRequiredMilestone = milestones.find(
    (milestone) => milestone.id === values.requiredMilestoneId
  );
  const eligibleRevealMilestones = selectedRequiredMilestone
    ? milestones.filter(
        (milestone) => milestone.position >= selectedRequiredMilestone.position
      )
    : milestones;

  useEffect(() => {
    if (!open || milestones.length === 0) {
      return;
    }

    setValues((currentValues) => {
      if (
        currentValues.requiredMilestoneId &&
        milestones.some(
          (milestone) => milestone.id === currentValues.requiredMilestoneId
        )
      ) {
        if (currentValues.type !== "PREDICTION") {
          return currentValues;
        }

        const requiredMilestone = milestones.find(
          (milestone) => milestone.id === currentValues.requiredMilestoneId
        );

        return {
          ...currentValues,
          prediction: {
            revealMilestoneId: chooseRevealMilestoneId({
              currentRevealMilestoneId:
                currentValues.prediction?.revealMilestoneId,
              milestones,
              requiredMilestone
            })
          }
        };
      }

      const requiredMilestone = milestones[0];

      return {
        ...currentValues,
        requiredMilestoneId: requiredMilestone?.id ?? "",
        prediction:
          currentValues.type === "PREDICTION"
            ? {
                revealMilestoneId: chooseRevealMilestoneId({
                  currentRevealMilestoneId:
                    currentValues.prediction?.revealMilestoneId,
                  milestones,
                  requiredMilestone
                })
              }
            : undefined
      };
    });
  }, [milestones, open]);

  const updateTextValue =
    (field: "body" | "title") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.value
      }));
      setErrors((currentErrors) => ({
        ...currentErrors,
        [field]: undefined
      }));
    };

  const updatePostType = (event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value as PostType;

    setValues((currentValues) => ({
      ...currentValues,
      type,
      prediction:
        type === "PREDICTION"
          ? {
              revealMilestoneId:
                currentValues.prediction?.revealMilestoneId ||
                currentValues.requiredMilestoneId ||
                milestones[0]?.id ||
                ""
            }
          : undefined
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      type: undefined,
      prediction: undefined
    }));
  };

  const updateMilestone = (event: ChangeEvent<HTMLSelectElement>) => {
    const requiredMilestoneId = event.target.value;
    const requiredMilestone = milestones.find(
      (milestone) => milestone.id === requiredMilestoneId
    );

    setValues((currentValues) => ({
      ...currentValues,
      requiredMilestoneId,
      prediction:
        currentValues.type === "PREDICTION"
          ? {
              revealMilestoneId: chooseRevealMilestoneId({
                currentRevealMilestoneId:
                  currentValues.prediction?.revealMilestoneId,
                milestones,
                requiredMilestone
              })
            }
          : undefined
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      requiredMilestoneId: undefined,
      prediction: undefined
    }));
  };

  const updatePredictionRevealMilestone = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      prediction: {
        revealMilestoneId: event.target.value
      }
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      prediction: undefined
    }));
  };

  const updateMediaAsset = (mediaAssetId: string | undefined) => {
    setValues((currentValues) => ({
      ...currentValues,
      mediaAssetId
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      mediaAssetId: undefined
    }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen && !isSaving) {
      setValues(getDefaultPostValues());
      setErrors({});
      setHasPendingImage(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createPostSchema.safeParse(values);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;

      setErrors({
        title: fieldErrors.title?.[0],
        body: fieldErrors.body?.[0],
        type: fieldErrors.type?.[0],
        requiredMilestoneId: fieldErrors.requiredMilestoneId?.[0],
        mediaAssetId: fieldErrors.mediaAssetId?.[0],
        prediction: fieldErrors.prediction?.[0]
      });
      return;
    }

    createPostMutation.mutate(parseResult.data, {
      onSuccess: () => {
        toast.success("Post created");
        setOpen(false);
        setValues(getDefaultPostValues());
        setErrors({});
        setHasPendingImage(false);
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not create post. Try again."
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <PlusCircle />
          New post
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create post</DialogTitle>
          <DialogDescription>
            Start a spoiler-safe discussion tied to a club milestone.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <PostFormField
            id="post-title"
            label="Title"
            error={errors.title}
          >
            <Input
              id="post-title"
              value={values.title}
              onChange={updateTextValue("title")}
              disabled={isSaving}
              maxLength={160}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "post-title-error" : undefined}
              placeholder="Opening thoughts"
            />
          </PostFormField>

          <PostFormField id="post-body" label="Body" error={errors.body}>
            <Textarea
              id="post-body"
              value={values.body}
              onChange={updateTextValue("body")}
              disabled={isSaving}
              maxLength={8000}
              rows={5}
              aria-invalid={!!errors.body}
              aria-describedby={errors.body ? "post-body-error" : undefined}
              placeholder="What do you want to discuss?"
            />
          </PostFormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <PostFormField id="post-type" label="Type" error={errors.type}>
              <select
                id="post-type"
                value={values.type}
                onChange={updatePostType}
                disabled={isSaving}
                className="h-10 w-full rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                aria-invalid={!!errors.type}
                aria-describedby={errors.type ? "post-type-error" : undefined}
              >
                {Object.entries(postTypeLabels).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </PostFormField>

            <PostFormField
              id="post-required-milestone"
              label="Required milestone"
              error={errors.requiredMilestoneId}
            >
              <select
                id="post-required-milestone"
                value={values.requiredMilestoneId}
                onChange={updateMilestone}
                disabled={isSaving || milestonesQuery.isPending}
                className="h-10 w-full rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                aria-invalid={!!errors.requiredMilestoneId}
                aria-describedby={
                  errors.requiredMilestoneId
                    ? "post-required-milestone-error"
                    : undefined
                }
              >
                <option value="">
                  {milestonesQuery.isPending
                    ? "Loading milestones..."
                    : "Choose milestone"}
                </option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {formatMilestoneOption(milestone)}
                  </option>
                ))}
              </select>
            </PostFormField>
          </div>

          {values.type === "PREDICTION" ? (
            <div className="grid gap-3 rounded-lg border border-default bg-inset p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <PostFormField
                id="post-prediction-reveal-milestone"
                label="Reveal milestone"
                error={errors.prediction}
              >
                <select
                  id="post-prediction-reveal-milestone"
                  value={values.prediction?.revealMilestoneId ?? ""}
                  onChange={updatePredictionRevealMilestone}
                  disabled={isSaving || milestonesQuery.isPending}
                  className="h-10 w-full rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                  aria-invalid={!!errors.prediction}
                  aria-describedby={
                    errors.prediction
                      ? "post-prediction-reveal-milestone-error"
                      : undefined
                  }
                >
                  <option value="">Choose reveal milestone</option>
                  {eligibleRevealMilestones.map((milestone) => (
                    <option key={milestone.id} value={milestone.id}>
                      {formatMilestoneOption(milestone)}
                    </option>
                  ))}
                </select>
              </PostFormField>
              <div className="rounded-md border border-subtle bg-surface px-3 py-2 text-xs text-muted">
                Status: Unresolved
              </div>
            </div>
          ) : null}

          <PostImageUploadField
            clubSlug={club.slug}
            disabled={isSaving}
            onAssetChange={updateMediaAsset}
            onPendingImageChange={setHasPendingImage}
          />

          {milestonesQuery.isError ? (
            <p className="text-sm text-warning">
              Could not load milestones. Close this dialog and try again.
            </p>
          ) : null}

          {milestonesQuery.isSuccess && milestones.length === 0 ? (
            <p className="text-sm text-muted">
              Add a milestone before creating posts.
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {isSaving
                ? "Creating..."
                : hasPendingImage
                  ? "Upload image first"
                  : "Create post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const PostFormField = ({
  children,
  error,
  id,
  label
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
}) => (
  <label className="grid gap-2 text-sm font-medium text-secondary" htmlFor={id}>
    {label}
    {children}
    {error ? (
      <span id={`${id}-error`} className="text-xs font-normal text-warning">
        {error}
      </span>
    ) : null}
  </label>
);

const chooseRevealMilestoneId = ({
  currentRevealMilestoneId,
  milestones,
  requiredMilestone
}: {
  currentRevealMilestoneId?: string;
  milestones: ClubMilestone[];
  requiredMilestone?: ClubMilestone;
}) => {
  const eligibleMilestones = requiredMilestone
    ? milestones.filter(
        (milestone) => milestone.position >= requiredMilestone.position
      )
    : milestones;

  if (
    currentRevealMilestoneId &&
    eligibleMilestones.some(
      (milestone) => milestone.id === currentRevealMilestoneId
    )
  ) {
    return currentRevealMilestoneId;
  }

  return eligibleMilestones[0]?.id ?? "";
};

export const PostCard = ({
  linked = false,
  onOptimisticReaction,
  onReactionReconciled,
  onReactionRollback,
  post
}: {
  linked?: boolean;
  onOptimisticReaction?: (post: ClubPostCard) => void;
  onReactionReconciled?: (post: ClubPostCard) => void;
  onReactionRollback?: (post: ClubPostCard | null) => void;
  post: ClubPostCard;
}) => {
  return post.visibility === "VISIBLE" ? (
    <VisiblePostCard
      linked={linked}
      onOptimisticReaction={onOptimisticReaction}
      onReactionReconciled={onReactionReconciled}
      onReactionRollback={onReactionRollback}
      post={post}
    />
  ) : (
    <LockedPostCard linked={linked} post={post} />
  );
};

const VisiblePostCard = ({
  linked,
  onOptimisticReaction,
  onReactionReconciled,
  onReactionRollback,
  post
}: {
  linked: boolean;
  onOptimisticReaction?: (post: ClubPostCard) => void;
  onReactionReconciled?: (post: ClubPostCard) => void;
  onReactionRollback?: (post: ClubPostCard | null) => void;
  post: Extract<ClubPostCard, { visibility: "VISIBLE" }>;
}) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <PostMetaRow post={post} />
      <div className="space-y-2">
        <h2 className="text-base font-semibold tracking-normal text-primary">
          {linked ? (
            <Link
              className="rounded-md transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              to={`/app/posts/${post.id}`}
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3">
        <span className="flex items-center gap-2 text-xs text-faint">
          <UserCircle className="size-4" />
          {post.author.displayName}
          {post.author.username ? ` / ${post.author.username}` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <PostCounts post={post} />
          <ReportDialog targetId={post.id} targetType="POST" />
          <PostReactionButtons
            counts={post.counts}
            onOptimisticReaction={onOptimisticReaction}
            onReactionReconciled={onReactionReconciled}
            onReactionRollback={onReactionRollback}
            postId={post.id}
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

const PostMediaPreview = ({
  locked = false,
  media
}: {
  locked?: boolean;
  media: NonNullable<ClubPostCard["media"]>;
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
      {locked ? "Safe preview" : "Post image"}
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
  post
}: {
  linked: boolean;
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
      {post.media ? <PostMediaPreview media={post.media} locked /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3">
        <span className="flex items-center gap-2 text-xs text-faint">
          <Clock3 className="size-4" />
          {formatDateTime(post.createdAt)}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <PostCounts post={post} />
          {linked ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/app/posts/${post.id}`}>Open</Link>
            </Button>
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
    <span>{formatDateTime(post.createdAt)}</span>
  </div>
);

const PostCounts = ({ post }: { post: ClubPostCard }) => (
  <span className="text-xs text-faint">
    {countFormatter.format(post.counts.commentCount)} comments /{" "}
    {countFormatter.format(post.counts.reactionCount)} reactions
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
      ariaLabel="Reactions"
      disabled={reactionMutation.isPending}
      reactions={counts.reactions}
      onToggle={(emoji) => handleReactionToggle(emoji)()}
    />
  );
};

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

const FeedEmpty = ({ activeTab }: { activeTab: ClubFeedTabValue }) => {
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
