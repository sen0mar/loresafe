import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileWarning, RefreshCw, ShieldCheck } from "lucide-react";

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
  const [selectedSlug, setSelectedSlug] = useState("");

  useEffect(() => {
    if (moderatableClubs.length === 0) {
      setSelectedSlug("");
      return;
    }

    setSelectedSlug((currentSlug) =>
      moderatableClubs.some((club) => club.slug === currentSlug)
        ? currentSlug
        : moderatableClubs[0].slug
    );
  }, [moderatableClubs]);

  const selectedClub = moderatableClubs.find(
    (club) => club.slug === selectedSlug
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <label
                className="text-xs font-medium text-faint"
                htmlFor="moderation-club"
              >
                Club
              </label>
              <select
                id="moderation-club"
                className="h-10 w-full rounded-md border border-subtle bg-surface px-3 text-sm text-primary outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand"
                value={selectedSlug}
                onChange={(event) => setSelectedSlug(event.target.value)}
              >
                {moderatableClubs.map((club) => (
                  <option key={club.id} value={club.slug}>
                    {club.title} - {roleLabels[club.role]}
                  </option>
                ))}
              </select>
              {selectedClub ? (
                <p className="text-xs text-faint">
                  {roleLabels[selectedClub.role]} access for /{selectedClub.slug}
                </p>
              ) : null}
            </div>
            <Button
              className="w-full sm:w-fit"
              type="button"
              variant="secondary"
              disabled={!selectedClub}
              asChild={!!selectedClub}
            >
              {selectedClub ? (
                <Link to={`/app/clubs/${selectedClub.slug}/settings/moderation`}>
                  <FileWarning />
                  Open reports
                </Link>
              ) : (
                <span>
                  <FileWarning />
                  Open reports
                </span>
              )}
            </Button>
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
