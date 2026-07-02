import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Compass, Globe2, PlusCircle, Search } from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  ActiveFilterBadges,
  ClubResults,
  PostResults,
  SearchEmpty,
  SearchFilterMenu,
  SearchLoading,
  parseFilters,
  toEffectiveSearchFilters
} from "@/features/search/pages/search-results-page";
import {
  type SearchFilter,
  useSearchResultsInfiniteQuery
} from "@/features/search/api/search";

import { usePublicClubsQuery } from "../api/clubs.js";
import { ClubDiscoveryCard } from "../components/club-discovery-card.js";
import {
  ExploreClubsEmpty,
  ExploreClubsError,
  ExploreClubsLoading
} from "../components/explore-clubs-states.js";

export const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const filters = parseFilters(searchParams);
  const effectiveFilters = toEffectiveSearchFilters(filters);
  const [searchValue, setSearchValue] = useState(query);
  const clubsQuery = usePublicClubsQuery(query.length === 0);
  const searchQuery = useSearchResultsInfiniteQuery(query, filters);
  const clubs = searchQuery.data?.pages.flatMap((page) => page.clubs) ?? [];
  const posts = searchQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const hasSearchResults = clubs.length > 0 || posts.length > 0;

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  const saveFilters = (nextFilters: SearchFilter[]) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);

      nextParams.delete("scope");

      if (nextFilters.length > 0) {
        nextParams.set("filters", nextFilters.join(","));
      } else {
        nextParams.delete("filters");
      }

      if (query) {
        nextParams.set("q", query);
      }

      return nextParams;
    });
  };

  const updateQuery = (nextQuery: string) => {
    setSearchValue(nextQuery);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      const normalizedQuery = nextQuery.trim();

      nextParams.delete("scope");

      if (normalizedQuery) {
        nextParams.set("q", normalizedQuery);
      } else {
        nextParams.delete("q");
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
        <section className="space-y-4 border-b border-default pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-brand">
                <Compass className="size-4" />
                Explore
              </p>
              <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
                Public clubs
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                Find spoiler-safe spaces and discussions that are open for discovery.
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
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            role="search"
            onSubmit={handleSearchSubmit}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                type="search"
                aria-label="Search Explore"
                placeholder="Search clubs or discussions..."
                className="h-10 pl-9"
                value={searchValue}
                onChange={(event) => updateQuery(event.target.value)}
              />
            </div>
            <SearchFilterMenu filters={filters} onFiltersSave={saveFilters} />
          </form>
        </section>

        {query && filters.length > 0 ? (
          <ActiveFilterBadges filters={filters} />
        ) : null}

        {query ? (
          searchQuery.isPending ? (
            <SearchLoading filters={effectiveFilters} />
          ) : searchQuery.isError ? (
            <ExploreClubsError onRetry={() => void searchQuery.refetch()} />
          ) : !hasSearchResults ? (
            <SearchEmpty filters={effectiveFilters} query={query} />
          ) : (
            <div className="space-y-5">
              {effectiveFilters.includes("clubs") ? (
                <ClubResults clubs={clubs} />
              ) : null}
              {effectiveFilters.includes("posts") ? (
                <PostResults posts={posts} />
              ) : null}
              {searchQuery.hasNextPage ? (
                <div className="flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted">
                    {countFormatter.format(clubs.length + posts.length)} results loaded
                  </p>
                  <Button
                    className="w-full sm:w-fit"
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={searchQuery.isFetchingNextPage}
                    onClick={() => void searchQuery.fetchNextPage()}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </div>
          )
        ) : clubsQuery.isPending ? (
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

const countFormatter = new Intl.NumberFormat();
