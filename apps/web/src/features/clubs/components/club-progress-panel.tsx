import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleDot,
  History,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Save
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import {
  type ClubMilestone,
  type ProgressMode,
  useClubMilestonesQuery,
  useClubProgressQuery,
  useUpdateClubProgressMutation
} from "../api/clubs.js";

type ClubProgressPanelProps = {
  slug: string;
  clubTitle?: string;
  isMember?: boolean;
};

const notStartedValue = "not-started";

const progressModeOptions: Array<{
  value: ProgressMode;
  label: string;
  description: string;
}> = [
  {
    value: "STRICT",
    label: "Strict",
    description: "Only show what is safely reached."
  },
  {
    value: "SOFT",
    label: "Soft",
    description: "Keep context careful without freezing discussion."
  },
  {
    value: "BRAVE",
    label: "Brave",
    description: "Allow more flexible nearby context."
  },
  {
    value: "FINISHED",
    label: "Finished",
    description: "Treat the full timeline as complete."
  }
];

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export const ClubProgressPanel = ({
  slug,
  clubTitle,
  isMember = true
}: ClubProgressPanelProps) => {
  const progressQuery = useClubProgressQuery(slug, isMember);
  const milestonesQuery = useClubMilestonesQuery(slug, 1);
  const updateProgressMutation = useUpdateClubProgressMutation(slug);
  const [selectedMilestoneId, setSelectedMilestoneId] =
    useState(notStartedValue);
  const [selectedMode, setSelectedMode] = useState<ProgressMode>("STRICT");

  const progress = progressQuery.data?.progress;
  const milestones = useMemo(
    () => milestonesQuery.data?.milestones ?? [],
    [milestonesQuery.data?.milestones]
  );

  useEffect(() => {
    if (!progress) {
      return;
    }

    setSelectedMilestoneId(progress.currentMilestone?.id ?? notStartedValue);
    setSelectedMode(progress.mode);
  }, [progress]);

  if (!isMember) {
    return <ProgressMembershipRequired />;
  }

  if (progressQuery.isPending || milestonesQuery.isPending) {
    return <ProgressLoading />;
  }

  if (progressQuery.isError || milestonesQuery.isError) {
    const isForbidden =
      progressQuery.error instanceof ApiError &&
      progressQuery.error.statusCode === 403;

    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
            <LockKeyhole className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-primary">
              {isForbidden ? "Progress is member-only" : "Progress unavailable"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {isForbidden
                ? "Join this club before setting your timeline."
                : "Refresh this panel and try again."}
            </p>
          </div>
          {isForbidden ? null : (
            <Button
              className="w-fit"
              variant="secondary"
              onClick={() => {
                void progressQuery.refetch();
                void milestonesQuery.refetch();
              }}
            >
              <RefreshCw />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return <ProgressLoading />;
  }

  const selectedMilestone =
    selectedMilestoneId === notStartedValue
      ? null
      : milestones.find((milestone) => milestone.id === selectedMilestoneId) ??
        null;
  const hasChanges =
    progress.currentMilestone?.id !==
      (selectedMilestone?.id ?? null) || progress.mode !== selectedMode;
  const activeMode = progressModeOptions.find(
    (mode) => mode.value === progress.mode
  );

  const saveProgress = () => {
    updateProgressMutation.mutate(
      {
        currentMilestoneId: selectedMilestone?.id ?? null,
        mode: selectedMode
      },
      {
        onSuccess: () => {
          toast.success("Progress updated");
        },
        onError: (error) => {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not update progress. Try again."
          );
        }
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>
            {clubTitle ?? "Your spoiler-safe checkpoint"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted">
                {getProgressLabel(progress.currentMilestone)}
              </span>
              <span className="font-mono text-primary">
                {progress.percentage}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">
              {progress.completedMilestones} of {progress.totalMilestones}{" "}
              milestones complete
            </p>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="text-muted">Current milestone</span>
            <select
              className="h-10 rounded-md border border-subtle bg-inset px-3 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
              value={selectedMilestoneId}
              disabled={updateProgressMutation.isPending}
              onChange={(event) => setSelectedMilestoneId(event.target.value)}
            >
              <option value={notStartedValue}>Not started</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {formatMilestoneOption(milestone)}
                </option>
              ))}
            </select>
          </label>

          {milestones.length === 0 ? (
            <div className="rounded-lg border border-default bg-inset p-3 text-sm text-muted">
              <ListChecks className="mb-2 size-4 text-faint" />
              No milestones have been added yet. You can still save a reading
              mode.
            </div>
          ) : null}

          <div className="grid gap-2">
            <p className="text-sm text-muted">Reading mode</p>
            {progressModeOptions.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={cn(
                  "rounded-lg border border-default bg-inset px-3 py-2 text-left transition-colors hover:border-strong hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60",
                  selectedMode === mode.value && "border-brand bg-active"
                )}
                disabled={updateProgressMutation.isPending}
                onClick={() => setSelectedMode(mode.value)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-primary">
                    {mode.label}
                  </span>
                  {selectedMode === mode.value ? (
                    <Check className="size-4 text-brand" />
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-faint">
                  {mode.description}
                </span>
              </button>
            ))}
          </div>

          <Button
            className="w-full"
            disabled={!hasChanges || updateProgressMutation.isPending}
            onClick={saveProgress}
          >
            <Save />
            {updateProgressMutation.isPending ? "Saving" : "Save progress"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDot className="size-5 text-brand" />
            Current mode
          </CardTitle>
          <CardDescription>{activeMode?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge>{activeMode?.label ?? progress.mode}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-faint" />
            Recent changes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.history.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              No progress changes recorded yet.
            </p>
          ) : (
            progress.history.map((historyRow) => (
              <div
                key={historyRow.id}
                className="rounded-lg border border-default bg-inset p-3"
              >
                <p className="text-sm text-primary">
                  {getProgressLabel(historyRow.toMilestone)}
                </p>
                <p className="mt-1 text-xs text-faint">
                  {formatMode(historyRow.fromMode)} to{" "}
                  {formatMode(historyRow.toMode)} ·{" "}
                  {formatDateTime(historyRow.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ProgressMembershipRequired = () => (
  <Card>
    <CardContent className="flex min-h-44 flex-col justify-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-muted">
        <LockKeyhole className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-primary">
          Progress is member-only
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Join this club before setting your timeline.
        </p>
      </div>
    </CardContent>
  </Card>
);

const ProgressLoading = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-40" />
    </CardHeader>
    <CardContent className="space-y-4">
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

const getProgressLabel = (
  milestone: { position: number; safeTitle: string } | null
) => (milestone ? `Milestone ${milestone.position}: ${milestone.safeTitle}` : "Not started");

const formatMilestoneOption = (milestone: ClubMilestone) =>
  `${milestone.position}. ${milestone.safeTitle}`;

const formatMode = (mode: ProgressMode) =>
  progressModeOptions.find((option) => option.value === mode)?.label ?? mode;
