import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  ListChecks,
  RefreshCw
} from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import {
  type ClubMilestone,
  useClubMilestonesQuery
} from "../api/clubs.js";

type ClubTimelineTabProps = {
  slug: string;
};

export const ClubTimelineTab = ({ slug }: ClubTimelineTabProps) => {
  const [page, setPage] = useState(1);
  const milestonesQuery = useClubMilestonesQuery(slug, page);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  if (milestonesQuery.isPending) {
    return <TimelineLoading />;
  }

  if (milestonesQuery.isError) {
    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col justify-center gap-3">
          <h2 className="text-base font-semibold text-primary">
            Timeline unavailable
          </h2>
          <p className="max-w-lg text-sm leading-6 text-muted">
            Milestones could not be loaded right now.
          </p>
          <Button
            className="w-fit"
            variant="secondary"
            onClick={() => void milestonesQuery.refetch()}
          >
            <RefreshCw />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { milestones, pagination } = milestonesQuery.data;

  if (milestones.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col justify-center gap-2">
          <ListChecks className="size-8 text-faint" />
          <h2 className="text-base font-semibold text-primary">
            No milestones yet
          </h2>
          <p className="max-w-lg text-sm leading-6 text-muted">
            This club does not have timeline checkpoints yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {milestones.map((milestone) => (
          <TimelineMilestoneCard key={milestone.id} milestone={milestone} />
        ))}
      </ol>

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
              disabled={pagination.page <= 1 || milestonesQuery.isFetching}
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
                milestonesQuery.isFetching
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

const TimelineMilestoneCard = ({
  milestone
}: {
  milestone: ClubMilestone;
}) => (
  <li className="grid gap-3 rounded-xl border border-default bg-elevated p-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
    <div className="flex size-11 items-center justify-center rounded-lg border border-strong bg-active font-mono text-sm font-medium text-brand">
      {milestone.position}
    </div>
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-normal text-primary">
            {milestone.safeTitle}
          </h3>
          {milestone.fullTitle ? (
            <p className="text-sm text-secondary">{milestone.fullTitle}</p>
          ) : null}
        </div>
        {milestone.isFullTitleHidden ? (
          <Badge variant="secondary">
            <EyeOff className="size-3" />
            Name hidden
          </Badge>
        ) : (
          <Badge variant="outline">
            <Flag className="size-3" />
            Safe name
          </Badge>
        )}
      </div>

      {milestone.description ? (
        <p className="text-sm leading-6 text-muted">
          {milestone.description}
        </p>
      ) : null}
    </div>
  </li>
);

const TimelineLoading = () => (
  <Card>
    <CardContent className="space-y-3 p-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          className="grid gap-3 rounded-xl border border-default bg-elevated p-4 sm:grid-cols-[3rem_minmax(0,1fr)]"
          key={index}
        >
          <Skeleton className="size-11" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);
