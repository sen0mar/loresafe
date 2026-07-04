import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  Filter,
  LockKeyhole,
  RefreshCw,
  Search,
  SearchX
} from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { ClubAvatar } from "@/features/clubs/components/club-avatar";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { formatClubCategory } from "@/features/clubs/lib/club-categories";
import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";

import {
  defaultSearchFilters,
  searchFilters,
  type SearchClub,
  type SearchFilter,
  type SearchPost,
  useSearchResultsInfiniteQuery
} from "../api/search.js";

const countFormatter = new Intl.NumberFormat();
export const typeFilters: SearchFilter[] = ["clubs", "posts"];
const validSearchFilters = new Set<SearchFilter>(defaultSearchFilters);
const filterLabelByValue = Object.fromEntries(
  searchFilters.map((filter) => [filter.value, filter.label])
) as Record<SearchFilter, string>;

export const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const filters = parseFilters(searchParams);
  const effectiveFilters = toEffectiveSearchFilters(filters);
  const searchQuery = useSearchResultsInfiniteQuery(query, filters);
  const clubs = searchQuery.data?.pages.flatMap((page) => page.clubs) ?? [];
  const posts = searchQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const hasQuery = query.length > 0;
  const hasResults = clubs.length > 0 || posts.length > 0;

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

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        <section className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-brand">
              <Search className="size-4" />
              Search
            </p>
            <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              {hasQuery ? `Results for "${query}"` : "Find clubs and discussions"}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Results respect club access and your current spoiler progress.
            </p>
          </div>
          <SearchFilterMenu filters={filters} onFiltersSave={saveFilters} />
        </section>

        {hasQuery && filters.length > 0 ? (
          <ActiveFilterBadges filters={filters} />
        ) : null}

        {!hasQuery ? (
          <SearchPrompt />
        ) : searchQuery.isPending ? (
          <SearchLoading filters={effectiveFilters} />
        ) : searchQuery.isError ? (
          <SearchError
            error={searchQuery.error}
            onRetry={() => void searchQuery.refetch()}
          />
        ) : !hasResults ? (
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
                  <ChevronDown />
                  {searchQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

export const SearchFilterMenu = ({
  filters,
  onFiltersSave
}: {
  filters: SearchFilter[];
  onFiltersSave: (filters: SearchFilter[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<SearchFilter[]>(filters);

  useEffect(() => {
    if (!open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const updateDraftFilter = (filter: SearchFilter, checked: boolean) => {
    setDraftFilters((currentFilters) =>
      toggleSearchFilter(currentFilters, filter, checked)
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
        <DropdownMenuLabel>Search filters</DropdownMenuLabel>
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

export const ActiveFilterBadges = ({ filters }: { filters: SearchFilter[] }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
    {filters.map((filter) => (
      <Badge key={filter} variant="secondary">
        {filterLabelByValue[filter]}
      </Badge>
    ))}
  </div>
);

export const ClubResults = ({ clubs }: { clubs: SearchClub[] }) => {
  if (clubs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-primary">Clubs</h2>
        <Badge variant="secondary">
          {countFormatter.format(clubs.length)} shown
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {clubs.map((club) => (
          <SearchClubCard key={club.id} club={club} />
        ))}
      </div>
    </section>
  );
};

export const PostResults = ({ posts }: { posts: SearchPost[] }) => {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-primary">Discussions</h2>
        <Badge variant="secondary">
          {countFormatter.format(posts.length)} shown
        </Badge>
      </div>
      <div className="space-y-3">
        {posts.map((result) => (
          <SearchPostResult key={result.post.id} result={result} />
        ))}
      </div>
    </section>
  );
};

const SearchPostResult = ({ result }: { result: SearchPost }) => (
  <div className="space-y-2">
    <Link
      className="inline-flex w-fit items-center gap-2 rounded-md text-xs text-faint transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      to={`/app/clubs/${result.club.linkName}`}
    >
      <Building2 className="size-3.5" />
      In {result.club.title}
    </Link>
    <PostCard post={result.post} linked />
  </div>
);

const SearchClubCard = ({ club }: { club: SearchClub }) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <div className="flex gap-3">
        <ClubAvatar title={club.title} coverUrl={club.coverUrl} />
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold text-primary">
            <Link
              className="rounded-md transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              to={`/app/clubs/${club.linkName}`}
            >
              {club.title}
            </Link>
          </h2>
          <p className="text-xs text-faint">
            {formatClubCategory(club.category)} /{" "}
            {countFormatter.format(club.memberCount)} members
          </p>
        </div>
      </div>
      {club.description ? (
        <p className="line-clamp-3 text-sm leading-6 text-muted">
          {club.description}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={club.visibility === "PUBLIC" ? "default" : "secondary"}>
          {formatVisibility(club.visibility)}
        </Badge>
        {club.visibility === "PUBLIC" ? null : (
          <Badge variant="outline">
            <LockKeyhole className="size-3" />
            Member access
          </Badge>
        )}
      </div>
    </CardContent>
  </Card>
);

const SearchPrompt = () => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-brand">
        <Search className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">
          Search ThreadSync
        </h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          Use the search bar above to find clubs and spoiler-safe discussions.
        </p>
      </div>
    </CardContent>
  </Card>
);

export const SearchEmpty = ({
  filters,
  query
}: {
  filters: SearchFilter[];
  query: string;
}) => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-faint">
        <SearchX className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">No results found</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          Nothing matched "{query}" with {formatFiltersForEmpty(filters)}.
        </p>
      </div>
    </CardContent>
  </Card>
);

export const SearchLoading = ({ filters }: { filters: SearchFilter[] }) => (
  <div className="space-y-5">
    {filters.includes("clubs") ? (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    ) : null}
    {filters.includes("posts") ? (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
          </Card>
        ))}
      </div>
    ) : null}
  </div>
);

const SearchError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isDenied =
    error instanceof ApiError &&
    (error.statusCode === 403 || error.statusCode === 404);

  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-warning">
          {isDenied ? (
            <LockKeyhole className="size-6" />
          ) : (
            <Search className="size-6" />
          )}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {isDenied ? "Search unavailable" : "Could not load search"}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">
            {isDenied
              ? "Search is unavailable from your account."
              : "Refresh results and try again."}
          </p>
        </div>
        {isDenied ? null : (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export const parseFilters = (searchParams: URLSearchParams): SearchFilter[] => {
  const filters = searchParams.get("filters");

  if (filters) {
    return normalizeFilters(filters.split(","));
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

const normalizeFilters = (filters: string[]): SearchFilter[] => {
  return defaultSearchFilters.filter(
    (filter) => filters.includes(filter) && validSearchFilters.has(filter)
  );
};

export const toggleSearchFilter = (
  currentFilters: SearchFilter[],
  filter: SearchFilter,
  checked: boolean
) => {
  const nextFilters = checked
    ? [...currentFilters, filter]
    : currentFilters.filter((currentFilter) => currentFilter !== filter);
  const normalized = defaultSearchFilters.filter((currentFilter) =>
    nextFilters.includes(currentFilter)
  );

  return normalized;
};

export const toEffectiveSearchFilters = (filters: SearchFilter[]) => {
  if (filters.length === 0) {
    return defaultSearchFilters;
  }

  const hasSafetyFilter =
    filters.includes("safe") || filters.includes("spoiler");

  if (hasSafetyFilter && !filters.includes("posts")) {
    return defaultSearchFilters.filter((filter) =>
      [...filters, "posts"].includes(filter)
    );
  }

  if (filters.includes("posts") && !hasSafetyFilter) {
    return defaultSearchFilters.filter((filter) =>
      [...filters, "safe", "spoiler"].includes(filter)
    );
  }

  return filters;
};

const formatFiltersForEmpty = (filters: SearchFilter[]) => {
  const labels = filters.map((filter) =>
    filterLabelByValue[filter].toLowerCase()
  );

  if (labels.length <= 1) {
    return `${labels[0] ?? "the selected"} filter`;
  }

  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)} filters`;
};

const formatVisibility = (visibility: SearchClub["visibility"]) =>
  visibility === "INVITE_ONLY"
    ? "Invite-only"
    : visibility.charAt(0) + visibility.slice(1).toLowerCase();
