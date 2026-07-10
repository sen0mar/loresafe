import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState
} from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Clock3,
  Image,
  LockKeyhole,
  LockKeyholeOpen,
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
import { cn } from "@/shared/lib/utils";
import { CreatePostDialog, FeedToolbar } from "./club-feed-controls.js";
import { FeedEmpty, FeedError, FeedLoading, PostCard } from "./club-feed-cards.js";
export { PostCard, PostReactionButtons, PredictionStateBadges } from "./club-feed-cards.js";

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
  useClubProgressQuery,
  useCreateClubPostMutation,
  useTogglePostReactionMutation
} from "../api/clubs.js";
import { usePostUnlockAnimation } from "../hooks/use-post-unlock-animation.js";
import {
  createPostSchema,
  type CreatePostFormValues
} from "../schemas/create-post.schema.js";
import { ReactionButtonGroup } from "./reaction-button-group.js";
import { ReportDialog } from "./report-dialog.js";
import { PostImageUploadField } from "./post-image-upload-field.js";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { DeletePostDialog } from "./delete-content-dialog.js";

type ClubFeedTabProps = {
  club: Club;
};

type PostDetailLinkState = {
  returnLabel: string;
  returnTo: string;
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
  const postsQuery = useClubPostsInfiniteQuery(club.linkName, activeTab);
  const progressQuery = useClubProgressQuery(
    club.linkName,
    club.membership.isMember
  );
  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data]
  );
  const unlockingPostIds = usePostUnlockAnimation({
    posts,
    progress: progressQuery.data?.progress
  });
  const createPostAction = club.membership.isMember ? (
    <CreatePostDialog club={club} />
  ) : null;
  const postReturnState: PostDetailLinkState = {
    returnLabel: "Feed",
    returnTo: `/app/clubs/${club.linkName}?tab=feed`
  };

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
            <PostCard
              key={post.id}
              isUnlocking={unlockingPostIds.has(post.id)}
              post={post}
              linked
              returnState={postReturnState}
            />
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
