import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Compass,
  Globe2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  Users
} from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import {
  type ClubVisibility,
  type JoinedClub,
  useJoinedClubsInfiniteQuery
} from "@/features/clubs/api/clubs";
import { ClubAvatar } from "@/features/clubs/components/club-avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";

const joinedClubsPageSize = 20;
const memberFormatter = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export const JoinedClubsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [searchValue, setSearchValue] = useState(query);
  const joinedClubsQuery = useJoinedClubsInfiniteQuery({
    q: query,
    limit: joinedClubsPageSize
  });
  const clubs =
    joinedClubsQuery.data?.pages.flatMap((page) => page.clubs) ?? [];
  const total = joinedClubsQuery.data?.pages[0]?.pagination.total ?? 0;
  const hasQuery = query.length > 0;

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  const updateQuery = (nextQuery: string) => {
    setSearchValue(nextQuery);
    setSearchParams(() => {
      const nextParams = new URLSearchParams();
      const normalizedQuery = nextQuery.trim();

      if (normalizedQuery) {
        nextParams.set("q", normalizedQuery);
      }

      return nextParams;
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(searchValue);
  };

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        <section className="soft-section-divider-bottom space-y-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-brand">
                <Users className="size-4" />
                Clubs
              </p>
              <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
                {hasQuery ? `Joined clubs matching "${query}"` : "Joined clubs"}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                Browse the clubs you already belong to. Search here stays inside
                your memberships.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <ShieldCheck className="size-3" />
                Member-only
              </Badge>
              <Button asChild variant="secondary">
                <Link to="/app/explore">
                  <Compass />
                  Explore
                </Link>
              </Button>
            </div>
          </div>

          <form
            className="relative"
            role="search"
            onSubmit={handleSearchSubmit}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              type="search"
              aria-label="Search My Clubs"
              placeholder="Search your joined clubs..."
              className="h-10 pl-9"
              value={searchValue}
              onChange={(event) => updateQuery(event.target.value)}
            />
          </form>
        </section>

        {joinedClubsQuery.isPending ? (
          <JoinedClubsLoading />
        ) : joinedClubsQuery.isError ? (
          <JoinedClubsError onRetry={() => void joinedClubsQuery.refetch()} />
        ) : clubs.length === 0 ? (
          hasQuery ? (
            <JoinedClubsNoMatches query={query} />
          ) : (
            <JoinedClubsEmpty />
          )
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Showing {memberFormatter.format(clubs.length)} of{" "}
                {memberFormatter.format(total)} joined{" "}
                {total === 1 ? "club" : "clubs"}
              </p>
              {hasQuery ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/app/clubs">
                    <SearchX />
                    Clear search
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {clubs.map((club) => (
                <JoinedClubCard key={club.id} club={club} />
              ))}
            </div>
            {joinedClubsQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={joinedClubsQuery.isFetchingNextPage}
                  onClick={() => void joinedClubsQuery.fetchNextPage()}
                >
                  <ChevronDown />
                  {joinedClubsQuery.isFetchingNextPage
                    ? "Loading..."
                    : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const JoinedClubCard = ({ club }: { club: JoinedClub }) => {
  const VisibilityIcon = visibilityIcons[club.visibility];

  return (
    <Card className="group h-full transition-colors hover:border-strong">
      <Link
        aria-label={`Open ${club.title}`}
        className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        to={`/app/clubs/${club.linkName}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <ClubAvatar
              title={club.title}
              coverUrl={club.coverUrl}
              className="size-10 border-brand shadow-glow"
            />
            <Badge variant={club.visibility === "PUBLIC" ? "default" : "secondary"}>
              <VisibilityIcon className="size-3" />
              {formatVisibility(club.visibility)}
            </Badge>
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-primary transition-colors group-hover:text-brand">
              {club.title}
            </h2>
            <p className="mt-1 truncate text-xs text-faint">/{club.linkName}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ClubMetric label="Role" value={formatRole(club.role)} />
            <ClubMetric
              label="Members"
              value={memberFormatter.format(club.memberCount)}
            />
          </div>
          <p className="text-sm text-muted">
            Joined {dateFormatter.format(new Date(club.joinedAt))}
          </p>
        </CardContent>
      </Link>
    </Card>
  );
};

const ClubMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-default bg-inset p-3">
    <p className="text-xs text-faint">{label}</p>
    <p className="mt-1 truncate text-sm font-medium text-primary">{value}</p>
  </div>
);

const JoinedClubsLoading = () => (
  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
    {Array.from({ length: 6 }, (_, index) => (
      <Card key={index}>
        <CardHeader className="space-y-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const JoinedClubsError = ({ onRetry }: { onRetry: () => void }) => (
  <PanelMessage
    icon={<RefreshCw className="size-6" />}
    title="Could not load joined clubs"
    description="Refresh your memberships and try again."
    action={
      <Button type="button" variant="secondary" onClick={onRetry}>
        <RefreshCw />
        Retry
      </Button>
    }
  />
);

const JoinedClubsEmpty = () => (
  <PanelMessage
    icon={<Users className="size-6" />}
    title="No joined clubs yet"
    description="Explore public clubs or accept an invite to start tracking progress with a group."
    action={
      <Button asChild>
        <Link to="/app/explore">
          <Compass />
          Explore clubs
        </Link>
      </Button>
    }
  />
);

const JoinedClubsNoMatches = ({ query }: { query: string }) => (
  <PanelMessage
    icon={<SearchX className="size-6" />}
    title="No joined clubs match"
    description={`Nothing in your joined clubs matched "${query}".`}
    action={
      <Button asChild variant="secondary">
        <Link to="/app/clubs">
          <SearchX />
          Clear search
        </Link>
      </Button>
    }
  />
);

const PanelMessage = ({
  action,
  description,
  icon,
  title
}: {
  action?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-brand">
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {action}
    </CardContent>
  </Card>
);

const visibilityIcons: Record<ClubVisibility, typeof Globe2> = {
  PUBLIC: Globe2,
  PRIVATE: LockKeyhole,
  INVITE_ONLY: KeyRound
};

const formatRole = (role: JoinedClub["role"]) =>
  role === "OWNER" ? "Owner" : role === "MODERATOR" ? "Moderator" : "Member";

const formatVisibility = (visibility: ClubVisibility) =>
  visibility === "INVITE_ONLY"
    ? "Invite-only"
    : visibility.charAt(0) + visibility.slice(1).toLowerCase();
