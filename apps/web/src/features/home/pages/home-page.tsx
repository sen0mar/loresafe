import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Compass,
  Library,
  PlusCircle,
  RefreshCw,
  type LucideIcon
} from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import {
  type ClubDiscoveryClub,
  usePublicClubsQuery
} from "@/features/clubs/api/clubs";
import { ClubAvatar } from "@/features/clubs/components/club-avatar";
import { formatClubCategory } from "@/features/clubs/lib/club-categories";
import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type HomeOption = {
  description: string;
  icon: LucideIcon;
  title: string;
  to: string;
};

const homeOptions: HomeOption[] = [
  {
    description: "Start a new spoiler-safe space.",
    icon: PlusCircle,
    title: "Create a new club",
    to: "/app/clubs/new"
  },
  {
    description: "Find public clubs to join.",
    icon: Compass,
    title: "Explore clubs",
    to: "/app/explore"
  },
  {
    description: "Open the clubs you have joined.",
    icon: Library,
    title: "My clubs",
    to: "/app/clubs"
  }
];

const popularClubsLimit = 3;

export const HomePage = () => {
  const popularClubsQuery = usePublicClubsQuery(true, {
    limit: popularClubsLimit,
    sort: "popular"
  });

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 py-1 lg:min-h-[calc(100dvh-8rem)]">
        <section className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-normal text-primary">
            What would you like to do?
          </h1>
          <p className="max-w-2xl text-sm leading-5 text-muted">
            Choose where to start in LoreSafe.
          </p>
        </section>

        <section
          aria-label="Home options"
          className="grid gap-3 md:grid-cols-3"
        >
          {homeOptions.map((option) => (
            <HomeOptionCard key={option.to} option={option} />
          ))}
        </section>

        <PopularClubsSection
          clubs={popularClubsQuery.data?.clubs ?? []}
          isError={popularClubsQuery.isError}
          isLoading={popularClubsQuery.isPending}
          onRetry={() => void popularClubsQuery.refetch()}
        />
      </div>
    </AuthenticatedAppShell>
  );
};

const HomeOptionCard = ({ option }: { option: HomeOption }) => {
  const Icon = option.icon;

  return (
    <Link
      to={option.to}
      className="group flex min-h-44 flex-col justify-between rounded-xl border border-default bg-elevated p-4 text-primary transition-all duration-150 ease-out hover:border-strong hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-base"
    >
      <div className="space-y-3">
        <span className="flex size-10 items-center justify-center rounded-lg border border-brand bg-active text-brand">
          <Icon className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-normal">
            {option.title}
          </h2>
          <p className="text-sm leading-5 text-muted">{option.description}</p>
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand">
        Open
        <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-1" />
      </span>
    </Link>
  );
};

const PopularClubsSection = ({
  clubs,
  isError,
  isLoading,
  onRetry
}: {
  clubs: ClubDiscoveryClub[];
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) => (
  <section
    className="soft-section-divider flex min-h-0 flex-1 flex-col gap-3 pt-4"
    aria-labelledby="popular-clubs-heading"
  >
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-0.5">
        <h2
          id="popular-clubs-heading"
          className="text-xl font-semibold tracking-normal text-primary"
        >
          Most popular clubs
        </h2>
        <p className="text-sm leading-5 text-muted">
          Public clubs with the most members right now.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link to="/app/explore?filters=popular">View all</Link>
      </Button>
    </div>

    {isLoading ? (
      <PopularClubsSkeleton />
    ) : isError ? (
      <PopularClubsMessage
        title="Could not load popular clubs"
        description="Refresh this section and try again."
        action={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        }
      />
    ) : clubs.length === 0 ? (
      <PopularClubsMessage
        title="No public clubs yet"
        description="Create a public club to help this section come alive."
      />
    ) : (
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 md:auto-rows-fr",
          clubs.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
        )}
      >
        {clubs.slice(0, popularClubsLimit).map((club) => (
          <HomePopularClubCard key={club.id} club={club} />
        ))}
      </div>
    )}
  </section>
);

const HomePopularClubCard = ({ club }: { club: ClubDiscoveryClub }) => (
  <Link
    aria-label={`Open ${club.title}`}
    to={getClubFeedPath(club.linkName)}
    className="group flex h-full min-h-44 flex-col rounded-xl border border-default bg-elevated p-4 text-primary transition-colors duration-150 hover:border-strong hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    <div className="flex items-start justify-between gap-3">
      <ClubAvatar
        title={club.title}
        coverUrl={club.coverUrl}
        className="size-9 border-brand"
      />
      <Badge>Public</Badge>
    </div>
    <div className="mt-3 min-w-0">
      <h3 className="truncate text-base font-semibold tracking-normal transition-colors group-hover:text-brand">
        {club.title}
      </h3>
      <p className="mt-0.5 truncate text-xs text-muted">/{club.linkName}</p>
    </div>
    <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">
      {club.description ?? "No description yet."}
    </p>
    <div className="mt-auto flex flex-wrap gap-3 pt-4 text-xs text-faint">
      <span>
        {club.memberCount.toLocaleString()}{" "}
        {club.memberCount === 1 ? "member" : "members"}
      </span>
      <span>{formatClubCategory(club.category)}</span>
    </div>
  </Link>
);

const PopularClubsSkeleton = () => (
  <div className="grid min-h-0 flex-1 gap-3 md:auto-rows-fr md:grid-cols-3">
    {Array.from({ length: 3 }, (_, index) => (
      <Card key={index} className="h-full min-h-44">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const PopularClubsMessage = ({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) => (
  <Card className="flex-1">
    <CardContent className="flex h-full min-h-44 flex-col items-center justify-center gap-3 p-4 text-center">
      <div>
        <h3 className="text-base font-semibold text-primary">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
      </div>
      {action}
    </CardContent>
  </Card>
);
