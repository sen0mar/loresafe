import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Search,
  SearchX
} from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import type { ClubPostCard } from "@/features/clubs/api/clubs";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

import {
  searchScopes,
  type SearchClub,
  type SearchScope,
  useSearchResultsInfiniteQuery
} from "../api/search.js";

const countFormatter = new Intl.NumberFormat();

export const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const scope = parseScope(searchParams.get("scope"));
  const searchQuery = useSearchResultsInfiniteQuery(query, scope);
  const clubs = searchQuery.data?.pages.flatMap((page) => page.clubs) ?? [];
  const posts = searchQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const hasQuery = query.length > 0;
  const hasResults = clubs.length > 0 || posts.length > 0;

  const updateScope = (nextScope: string) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);

      nextParams.set("scope", parseScope(nextScope));

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
          <Tabs value={scope} onValueChange={updateScope}>
            <TabsList>
              {searchScopes.map((searchScope) => (
                <TabsTrigger key={searchScope.value} value={searchScope.value}>
                  {searchScope.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>

        {!hasQuery ? (
          <SearchPrompt />
        ) : searchQuery.isPending ? (
          <SearchLoading scope={scope} />
        ) : searchQuery.isError ? (
          <SearchError
            error={searchQuery.error}
            onRetry={() => void searchQuery.refetch()}
          />
        ) : !hasResults ? (
          <SearchEmpty query={query} />
        ) : (
          <div className="space-y-5">
            {scope !== "posts" ? <ClubResults clubs={clubs} /> : null}
            {scope !== "clubs" ? <PostResults posts={posts} /> : null}
            {searchQuery.hasNextPage ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface p-3">
                <p className="text-sm text-muted">
                  {countFormatter.format(clubs.length + posts.length)} results loaded
                </p>
                <Button
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

const ClubResults = ({ clubs }: { clubs: SearchClub[] }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-primary">Clubs</h2>
      <Badge variant="secondary">
        {countFormatter.format(clubs.length)} shown
      </Badge>
    </div>
    {clubs.length === 0 ? (
      <SectionEmpty
        icon={<Building2 className="size-5" />}
        title="No matching clubs"
        body="Try another title, category, or club slug."
      />
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {clubs.map((club) => (
          <SearchClubCard key={club.id} club={club} />
        ))}
      </div>
    )}
  </section>
);

const PostResults = ({
  posts
}: {
  posts: ClubPostCard[];
}) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-primary">Discussions</h2>
      <Badge variant="secondary">
        {countFormatter.format(posts.length)} shown
      </Badge>
    </div>
    {posts.length === 0 ? (
      <SectionEmpty
        icon={<MessageSquareText className="size-5" />}
        title="No matching discussions"
        body="Discussions you can access will appear here."
      />
    ) : (
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} linked />
        ))}
      </div>
    )}
  </section>
);

const SearchClubCard = ({ club }: { club: SearchClub }) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <div className="flex gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-inset text-brand">
          {club.coverUrl ? (
            <img
              src={club.coverUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <Building2 className="size-5" />
          )}
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold text-primary">
            <Link
              className="rounded-md transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              to={`/app/clubs/${club.slug}`}
            >
              {club.title}
            </Link>
          </h2>
          <p className="text-xs text-faint">
            {club.category ?? "Uncategorized"} /{" "}
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

const SearchEmpty = ({ query }: { query: string }) => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-faint">
        <SearchX className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">No results found</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          Nothing matched "{query}" in clubs or discussions you can access.
        </p>
      </div>
    </CardContent>
  </Card>
);

const SearchLoading = ({ scope }: { scope: SearchScope }) => (
  <div className="space-y-5">
    {scope !== "posts" ? (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="size-11 rounded-lg" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    ) : null}
    {scope !== "clubs" ? (
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

const SectionEmpty = ({
  body,
  icon,
  title
}: {
  body: string;
  icon: ReactNode;
  title: string;
}) => (
  <Card>
    <CardContent className="flex min-h-36 flex-col justify-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-faint">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-primary">{title}</h3>
      <p className="max-w-lg text-sm leading-6 text-muted">{body}</p>
    </CardContent>
  </Card>
);

const parseScope = (value: string | null): SearchScope =>
  value === "clubs" || value === "posts" ? value : "all";

const formatVisibility = (visibility: SearchClub["visibility"]) =>
  visibility === "INVITE_ONLY"
    ? "Invite-only"
    : visibility.charAt(0) + visibility.slice(1).toLowerCase();
