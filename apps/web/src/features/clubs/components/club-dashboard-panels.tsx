import { BarChart3, TrendingUp } from "lucide-react";

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
  type ProgressMode,
  useClubDashboardStatsQuery,
  useClubProgressSummaryQuery
} from "../api/clubs.js";
import { MilestoneProgressDots } from "./milestone-progress-dots.js";

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
const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));

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

  return (
    <div className="space-y-4">
      <MyOverviewPanel
        clubDescription={club.description}
        isError={statsQuery.isError}
        isPending={statsQuery.isPending}
        stats={statsQuery.data?.stats}
      />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatsPanel
          isError={statsQuery.isError}
          isPending={statsQuery.isPending}
          stats={statsQuery.data?.stats}
          createdAt={club.createdAt}
        />
        <ProgressSummaryPanel
          error={progressSummaryQuery.error}
          isError={progressSummaryQuery.isError}
          isPending={progressSummaryQuery.isPending && isMember}
          progress={progressSummaryQuery.data?.progress}
        />
      </div>
    </div>
  );
};

const StatsPanel = ({
  isError,
  isPending,
  stats,
  createdAt
}: {
  isError: boolean;
  isPending: boolean;
  createdAt: string;
  stats?: {
    memberCount: number;
    milestoneCount: number;
    visiblePostCount: number;
    visibleCommentCount: number;
    postReactionCount: number;
    safePostCount: number;
    lockedPostCount: number;
    viewer: {
      joinedAt: string | null;
      postCount: number;
      commentCount: number;
    };
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
        <Metric label="Created" value={formatDate(createdAt)} />
        <Metric label="Milestones" value={formatCount(stats.milestoneCount)} />
        <Metric label="Discussions" value={formatCount(stats.visiblePostCount)} />
        <Metric label="Comments" value={formatCount(stats.visibleCommentCount)} />
        <Metric label="Reactions" value={formatCount(stats.postReactionCount)} />
      </CardContent>
    </Card>
  );
};

const MyOverviewPanel = ({
  clubDescription,
  isError,
  isPending,
  stats
}: {
  clubDescription: string | null;
  isError: boolean;
  isPending: boolean;
  stats?: {
    safePostCount: number;
    lockedPostCount: number;
    viewer: {
      joinedAt: string | null;
      postCount: number;
      commentCount: number;
    };
  };
}) => (
  <Card>
    <CardHeader>
      <CardTitle>My overview</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        {clubDescription ?? "No description yet."}
      </p>
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError || !stats ? null : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Joined"
            value={
              stats.viewer.joinedAt
                ? formatDate(stats.viewer.joinedAt)
                : "Not joined"
            }
          />
          <Metric label="My posts" value={formatCount(stats.viewer.postCount)} />
          <Metric
            label="My comments"
            value={formatCount(stats.viewer.commentCount)}
          />
          <Metric
            label="Safe"
            value={formatCount(stats.safePostCount)}
          />
          <Metric
            label="Locked"
            value={formatCount(stats.lockedPostCount)}
          />
        </div>
      )}
    </CardContent>
  </Card>
);

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
          <MilestoneProgressDots
            className="mt-2"
            completedMilestones={progress.completedMilestones}
            totalMilestones={progress.totalMilestones}
          />
        </div>
        <p className="text-sm text-muted">
          {progress.completedMilestones} of {progress.totalMilestones} milestones complete
        </p>
      </CardContent>
    </Card>
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
