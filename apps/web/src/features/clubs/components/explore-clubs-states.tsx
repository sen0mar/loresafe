import { Compass, RefreshCw, SearchX } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { ClubCardGrid } from "./club-card-grid.js";

export const ExploreClubsLoading = () => (
  <ClubCardGrid>
    {Array.from({ length: 6 }, (_, index) => (
      <Card key={index}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-28" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardContent>
      </Card>
    ))}
  </ClubCardGrid>
);

export const ExploreClubsEmpty = () => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-brand">
        <SearchX className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">No public clubs yet</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          Public discovery will fill in as clubs are published.
        </p>
      </div>
    </CardContent>
  </Card>
);

export const ExploreClubsError = ({
  onRetry
}: {
  onRetry: () => void;
}) => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-warning">
        <Compass className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">
          Could not load clubs
        </h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          Refresh discovery and try again.
        </p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        <RefreshCw />
        Retry
      </Button>
    </CardContent>
  </Card>
);
