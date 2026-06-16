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
  type ClubPostCard,
  type PostType,
  useClubMilestonesQuery,
  useClubPostsInfiniteQuery,
  useCreateClubPostMutation
} from "../api/clubs.js";
import {
  createPostSchema,
  type CreatePostFormValues
} from "../schemas/create-post.schema.js";
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
  requiredMilestoneId: ""
});

const formatMilestoneOption = (milestone: ClubMilestone) =>
  `${milestone.position}. ${milestone.safeTitle}`;

const feedTabs: Array<{ value: ClubFeedTabValue; label: string }> = [
  {
    value: "safe",
    label: "Safe"
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
        <FeedEmpty />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} linked />
          ))}
        </div>
      )}

      {postsQuery.hasNextPage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface p-3">
          <p className="text-sm text-muted">
            {countFormatter.format(posts.length)} loaded
          </p>
          <Button
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
  <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as ClubFeedTabValue)}
    >
      <TabsList className="max-w-full overflow-x-auto">
        {feedTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
    {action}
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
  const milestonesQuery = useClubMilestonesQuery(club.slug, 1, open);
  const createPostMutation = useCreateClubPostMutation(club.slug);
  const milestones = milestonesQuery.data?.milestones ?? [];
  const isSaving = createPostMutation.isPending;
  const canSubmit =
    !isSaving && !milestonesQuery.isPending && milestones.length > 0;

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
        return currentValues;
      }

      return {
        ...currentValues,
        requiredMilestoneId: milestones[0]?.id ?? ""
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
    setValues((currentValues) => ({
      ...currentValues,
      type: event.target.value as PostType
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      type: undefined
    }));
  };

  const updateMilestone = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      requiredMilestoneId: event.target.value
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      requiredMilestoneId: undefined
    }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen && !isSaving) {
      setValues(getDefaultPostValues());
      setErrors({});
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
        requiredMilestoneId: fieldErrors.requiredMilestoneId?.[0]
      });
      return;
    }

    createPostMutation.mutate(parseResult.data, {
      onSuccess: () => {
        toast.success("Post created");
        setOpen(false);
        setValues(getDefaultPostValues());
        setErrors({});
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
                className="h-10 rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
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
                className="h-10 rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
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
              {isSaving ? "Creating..." : "Create post"}
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

export const PostCard = ({
  linked = false,
  post
}: {
  linked?: boolean;
  post: ClubPostCard;
}) => {
  const card =
    post.visibility === "VISIBLE" ? (
      <VisiblePostCard post={post} />
    ) : (
      <LockedPostCard post={post} />
    );

  if (!linked) {
    return card;
  }

  return (
    <Link
      className="block rounded-xl transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      to={`/app/posts/${post.id}`}
    >
      {card}
    </Link>
  );
};

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
