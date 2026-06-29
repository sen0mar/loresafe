import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileWarning, RefreshCw, ShieldCheck } from "lucide-react";

import { useJoinedClubsQuery } from "@/features/clubs/api/clubs";
import type { JoinedClub } from "@/features/clubs/api/clubs";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const roleLabels: Record<JoinedClub["role"], string> = {
  OWNER: "Owner",
  MODERATOR: "Moderator",
  MEMBER: "Member"
};

const canModerateClub = (club: JoinedClub) =>
  club.role === "OWNER" || club.role === "MODERATOR";

export const ModerationSettingsPanel = () => {
  const joinedClubsQuery = useJoinedClubsQuery();
  const moderatableClubs = useMemo(
    () => joinedClubsQuery.data?.clubs.filter(canModerateClub) ?? [],
    [joinedClubsQuery.data?.clubs]
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileWarning className="size-5 text-warning" />
            Moderation
          </CardTitle>
          <p className="mt-1 text-sm leading-5 text-muted">
            Open report queues for clubs you moderate.
          </p>
        </div>
        <Badge variant="secondary">
          <ShieldCheck className="size-3" />
          Reports
        </Badge>
      </CardHeader>
      <CardContent>
        {joinedClubsQuery.isPending ? (
          <ModerationSettingsLoading />
        ) : joinedClubsQuery.isError ? (
          <ModerationSettingsError
            onRetry={() => void joinedClubsQuery.refetch()}
          />
        ) : moderatableClubs.length === 0 ? (
          <div className="rounded-lg border border-default bg-inset p-4">
            <p className="text-sm font-medium text-primary">
              No moderation clubs yet
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Clubs where you are an owner or moderator will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {moderatableClubs.map((club) => (
              <Link
                key={club.id}
                className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-default bg-inset px-4 py-3 text-sm transition-colors hover:border-strong hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                to={`/app/clubs/${club.linkName}/settings/moderation`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-primary">
                    {club.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-faint">
                    {roleLabels[club.role]} / {club.linkName}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-brand">
                  Open reports
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ModerationSettingsLoading = () => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-36" />
    <Skeleton className="h-10 w-full" />
  </div>
);

const ModerationSettingsError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col gap-3 rounded-lg border border-default bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-medium text-primary">
        Could not load moderation clubs
      </p>
      <p className="mt-1 text-sm leading-6 text-muted">
        Refresh your joined clubs and try again.
      </p>
    </div>
    <Button
      className="w-full sm:w-fit"
      type="button"
      variant="secondary"
      size="sm"
      onClick={onRetry}
    >
      <RefreshCw />
      Retry
    </Button>
  </div>
);
