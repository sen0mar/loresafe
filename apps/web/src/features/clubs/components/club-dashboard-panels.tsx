import {
  BarChart3,
  LockKeyhole,
  MessageSquareText,
  Sparkles,
  TrendingUp
} from "lucide-react";

import { ApiError } from "@/shared/api/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import {
  type Club,
  type ClubPostCard,
  type ProgressMode,
  useClubDashboardStatsQuery,
  useClubProgressSummaryQuery,
  usePopularDiscussionsQuery,
  useRecentlyUnlockedSummaryQuery
} from "../api/clubs.js";
import { PostCard } from "./club-feed-tab.js";

type ClubDashboardPanelsProps = {
  club: Club;
};

const numberFormatter = new Intl.NumberFormat();

const progressModeLabels: Record<ProgressMode, string> = {
  STRICT: "Strict",
  SOFT: "Soft",
  BRAVE: "Brave",
  FINISHED: "Finished"
};

const formatCount = (count: number) => numberFormatter.format(count);

const isHiddenPanelError = (error: Error | null) =>
  error instanceof ApiError &&
  (error.statusCode === 403 || error.statusCode === 404);

export const ClubDashboardPanels = ({ club }: ClubDashboardPanelsProps) => {
  const isMember = club.membership.isMember;
  const statsQuery = useClubDashboardStatsQuery(club.linkName);
  const progressSummaryQuery = useClubProgressSummaryQuery(
    club.linkName,
    isMember
  );
  const popularDiscussionsQuery = usePopularDiscussionsQuery(club.linkName);
  const recentlyUnlockedSummaryQuery = useRecentlyUnlockedSummaryQuery(
    club.linkName,
    isMember
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatsPanel
          isError={statsQuery.isError}
          isPending={statsQuery.isPending}
          stats={statsQuery.data?.stats}
        />
        <ProgressSummaryPanel
          error={progressSummaryQuery.error}
          isError={progressSummaryQuery.isError}
          isPending={progressSummaryQuery.isPending && isMember}
          progress={progressSummaryQuery.data?.progress}
        />
      </div>

      <RecentlyUnlockedSummaryPanel
        error={recentlyUnlockedSummaryQuery.error}
        isError={recentlyUnlockedSummaryQuery.isError}
        isPending={recentlyUnlockedSummaryQuery.isPending && isMember}
        posts={recentlyUnlockedSummaryQuery.data?.posts}
        unlockedAt={recentlyUnlockedSummaryQuery.data?.unlock.unlockedAt}
      />

      <PopularDiscussionsPanel
        discussions={popularDiscussionsQuery.data?.discussions}
        isError={popularDiscussionsQuery.isError}
        isPending={popularDiscussionsQuery.isPending}
      />
    </div>
  );
};

const StatsPanel = ({
  isError,
  isPending,
  stats
}: {
  isError: boolean;
  isPending: boolean;
  stats?: {
    memberCount: number;
    milestoneCount: number;
    visiblePostCount: number;
    visibleCommentCount: number;
    postReactionCount: number;
    safePostCount: number;
    lockedPostCount: number;
  };
}) => {
  if (isPending) {
    return <DashboardCardSkeleton />;
  }

  if (isError || !stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5 text-brand" />
          Club stats
        </CardTitle>
        <CardDescription>Visible records in this club</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Metric label="Members" value={formatCount(stats.memberCount)} />
        <Metric label="Milestones" value={formatCount(stats.milestoneCount)} />
        <Metric label="Discussions" value={formatCount(stats.visiblePostCount)} />
        <Metric label="Comments" value={formatCount(stats.visibleCommentCount)} />
        <Metric label="Reactions" value={formatCount(stats.postReactionCount)} />
        <Metric
          label="Safe / locked"
          value={`${formatCount(stats.safePostCount)} / ${formatCount(
            stats.lockedPostCount
          )}`}
        />
      </CardContent>
    </Card>
  );
};

const ProgressSummaryPanel = ({
  error,
  isError,
  isPending,
  progress
}: {
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  progress?: {
    mode: ProgressMode;
    currentMilestone: { position: number; label: string } | null;
    totalMilestones: number;
    completedMilestones: number;
    percentage: number;
    updatedAt: string | null;
  };
}) => {
  if (isPending) {
    return <DashboardCardSkeleton />;
  }

  if (isHiddenPanelError(error) || isError || !progress) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-brand" />
          Progress summary
        </CardTitle>
        <CardDescription>{progressModeLabels[progress.mode]} mode</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted">
              {progress.currentMilestone
                ? `Milestone ${progress.currentMilestone.position}: ${progress.currentMilestone.label}`
                : "Not started"}
            </span>
            <span className="font-mono text-primary">
              {progress.percentage}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
        <p className="text-sm text-muted">
          {progress.completedMilestones} of {progress.totalMilestones} milestones complete
        </p>
      </CardContent>
    </Card>
  );
};

const RecentlyUnlockedSummaryPanel = ({
  error,
  isError,
  isPending,
  posts,
  unlockedAt
}: {
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  posts?: ClubPostCard[];
  unlockedAt?: string | null;
}) => {
  if (isPending) {
    return <PostListSkeleton title="Recently unlocked" />;
  }

  if (isHiddenPanelError(error) || isError || !posts || posts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
            <Sparkles className="size-5 text-brand" />
            Recently unlocked
          </h2>
          <p className="mt-1 text-sm text-muted">
            {unlockedAt
              ? `Unlocked ${formatDateTime(unlockedAt)}`
              : "Newly safe discussions"}
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} linked />
        ))}
      </div>
    </section>
  );
};

const PopularDiscussionsPanel = ({
  discussions,
  isError,
  isPending
}: {
  discussions?: Array<{
    post: ClubPostCard;
    engagementScore: number;
  }>;
  isError: boolean;
  isPending: boolean;
}) => {
  if (isPending) {
    return <PostListSkeleton title="Popular discussions" />;
  }

  if (isError || !discussions || discussions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
          <MessageSquareText className="size-5 text-brand" />
          Popular discussions
        </h2>
        <p className="mt-1 text-sm text-muted">
          Ranked by visible comments and reactions
        </p>
      </div>
      <div className="grid gap-3">
        {discussions.map((discussion) => (
          <PostCard
            key={discussion.post.id}
            post={discussion.post}
            linked
          />
        ))}
      </div>
    </section>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-default bg-inset p-3">
    <p className="text-xs text-faint">{label}</p>
    <p className="mt-1 text-sm font-medium text-primary">{value}</p>
  </div>
);

const DashboardCardSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-44" />
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </CardContent>
  </Card>
);

const PostListSkeleton = ({ title }: { title: string }) => (
  <section className="space-y-3">
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
        <LockKeyhole className="size-5 text-faint" />
        {title}
      </h2>
      <Skeleton className="mt-2 h-4 w-48" />
    </div>
    <div className="grid gap-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </section>
);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
