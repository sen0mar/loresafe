import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Filter, PlusCircle, Search } from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { ClubCardGrid } from "@/features/clubs/components/club-card-grid";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import {
  ClubResults,
  PostResults,
  SearchEmpty,
  SearchLoading,
  toEffectiveSearchFilters
} from "@/features/search/pages/search-results-page";
import {
  defaultSearchFilters,
  searchFilters,
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

type ExploreFilter = SearchFilter | "popular";

const popularFilter: { value: ExploreFilter; label: string } = {
  value: "popular",
  label: "Most popular"
};
const exploreFilters: Array<{ value: ExploreFilter; label: string }> = [
  popularFilter,
  ...searchFilters
];
const filterLabelByValue = Object.fromEntries(
  exploreFilters.map((filter) => [filter.value, filter.label])
) as Record<ExploreFilter, string>;
const validExploreFilters = new Set<ExploreFilter>([
  "popular",
  ...defaultSearchFilters
]);
const exploreClubLimit = 20;

export const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const filters = parseExploreFilters(searchParams);
  const searchResultFilters = getSearchResultFilters(filters);
  const effectiveFilters = toEffectiveSearchFilters(searchResultFilters);
  const isPopularFilterActive = filters.includes("popular");
  const [searchValue, setSearchValue] = useState(query);
  const clubsQuery = usePublicClubsQuery(query.length === 0, {
    limit: exploreClubLimit,
    sort: isPopularFilterActive ? "popular" : "newest"
  });
  const searchQuery = useSearchResultsInfiniteQuery(query, searchResultFilters);
  const clubs = searchQuery.data?.pages.flatMap((page) => page.clubs) ?? [];
  const posts = searchQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const hasSearchResults = clubs.length > 0 || posts.length > 0;

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  const saveFilters = (nextFilters: ExploreFilter[]) => {
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
        <section className="space-y-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
                Public clubs
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                Find spoiler-safe spaces and discussions that are open for discovery.
              </p>
            </div>
            <div className="flex shrink-0">
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
            <ExploreFilterMenu filters={filters} onFiltersSave={saveFilters} />
          </form>
        </section>

        {filters.length > 0 ? (
          <ActiveExploreFilterBadges filters={filters} />
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
          <ClubCardGrid>
            {clubsQuery.data.clubs.slice(0, exploreClubLimit).map((club) => (
              <ClubDiscoveryCard key={club.id} club={club} />
            ))}
          </ClubCardGrid>
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const countFormatter = new Intl.NumberFormat();

const ExploreFilterMenu = ({
  filters,
  onFiltersSave
}: {
  filters: ExploreFilter[];
  onFiltersSave: (filters: ExploreFilter[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ExploreFilter[]>(filters);

  useEffect(() => {
    if (!open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const updateDraftFilter = (filter: ExploreFilter, checked: boolean) => {
    setDraftFilters((currentFilters) =>
      toggleExploreFilter(currentFilters, filter, checked)
    );
  };

  const saveFilters = () => {
    onFiltersSave(draftFilters);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary">
          <Filter />
          Add filters
          <Badge variant="outline">{filters.length}</Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Explore filters</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={draftFilters.includes("popular")}
          onCheckedChange={(checked) =>
            updateDraftFilter("popular", checked === true)
          }
          onSelect={(event) => event.preventDefault()}
        >
          Most popular
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {searchFilters.slice(0, 2).map((filter) => (
          <DropdownMenuCheckboxItem
            key={filter.value}
            checked={draftFilters.includes(filter.value)}
            onCheckedChange={(checked) =>
              updateDraftFilter(filter.value, checked === true)
            }
            onSelect={(event) => event.preventDefault()}
          >
            {filter.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {searchFilters.slice(2).map((filter) => (
          <DropdownMenuCheckboxItem
            key={filter.value}
            checked={draftFilters.includes(filter.value)}
            onCheckedChange={(checked) =>
              updateDraftFilter(filter.value, checked === true)
            }
            onSelect={(event) => event.preventDefault()}
          >
            {filter.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <div className="p-1">
          <Button className="w-full" size="sm" type="button" onClick={saveFilters}>
            Save
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ActiveExploreFilterBadges = ({
  filters
}: {
  filters: ExploreFilter[];
}) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
    {filters.map((filter) => (
      <Badge key={filter} variant="secondary">
        {filterLabelByValue[filter]}
      </Badge>
    ))}
  </div>
);

const parseExploreFilters = (searchParams: URLSearchParams): ExploreFilter[] => {
  const filters = searchParams.get("filters");

  if (filters) {
    return normalizeExploreFilters(filters.split(","));
  }

  const legacyScope = searchParams.get("scope");

  if (legacyScope === "clubs") {
    return ["clubs"];
  }

  if (legacyScope === "posts") {
    return ["safe", "spoiler", "posts"];
  }

  return [];
};

const normalizeExploreFilters = (filters: string[]): ExploreFilter[] =>
  exploreFilters
    .map((filter) => filter.value)
    .filter(
      (filter) => filters.includes(filter) && validExploreFilters.has(filter)
    );

const toggleExploreFilter = (
  currentFilters: ExploreFilter[],
  filter: ExploreFilter,
  checked: boolean
) => {
  const nextFilters = checked
    ? [...currentFilters, filter]
    : currentFilters.filter((currentFilter) => currentFilter !== filter);

  return exploreFilters
    .map((filterOption) => filterOption.value)
    .filter((filterOption) => nextFilters.includes(filterOption));
};

const getSearchResultFilters = (filters: ExploreFilter[]): SearchFilter[] =>
  filters.filter((filter): filter is SearchFilter => filter !== "popular");
