import { Link } from "react-router-dom";
import { Compass, Globe2, PlusCircle } from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

import { usePublicClubsQuery } from "../api/clubs.js";
import { ClubDiscoveryCard } from "../components/club-discovery-card.js";
import {
  ExploreClubsEmpty,
  ExploreClubsError,
  ExploreClubsLoading
} from "../components/explore-clubs-states.js";

export const ExplorePage = () => {
  const clubsQuery = usePublicClubsQuery();

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        <section className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-brand">
              <Compass className="size-4" />
              Explore
            </p>
            <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              Public clubs
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Find spoiler-safe spaces that are open for discovery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>
              <Globe2 className="size-3" />
              Public only
            </Badge>
            <Button asChild>
              <Link to="/app/clubs/new">
                <PlusCircle />
                Create club
              </Link>
            </Button>
          </div>
        </section>

        {clubsQuery.isPending ? (
          <ExploreClubsLoading />
        ) : clubsQuery.isError ? (
          <ExploreClubsError onRetry={() => void clubsQuery.refetch()} />
        ) : clubsQuery.data.clubs.length === 0 ? (
          <ExploreClubsEmpty />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {clubsQuery.data.clubs.map((club) => (
              <ClubDiscoveryCard key={club.id} club={club} />
            ))}
          </div>
        )}
      </div>
    </AuthenticatedAppShell>
  );
};
