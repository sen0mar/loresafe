import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Sparkles
} from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ApiError } from "@/shared/api/api-client";

import {
  useClubQuery,
  useRecentlyUnlockedQuery
} from "../api/clubs.js";
import { PostCard } from "../components/club-feed-tab.js";

const countFormatter = new Intl.NumberFormat();

export const RecentlyUnlockedPage = () => {
  const { linkName = "" } = useParams();
  const clubQuery = useClubQuery(linkName);
  const recentlyUnlockedQuery = useRecentlyUnlockedQuery(linkName);
  const posts =
    recentlyUnlockedQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const latestUnlock =
    recentlyUnlockedQuery.data?.pages[0]?.unlock ?? null;
  const forwardUnlock =
    latestUnlock && latestUnlock.toPosition > latestUnlock.fromPosition
      ? latestUnlock
      : null;

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        <section className="soft-section-divider-bottom flex flex-wrap items-start justify-between gap-4 pb-4">
          <div className="min-w-0 space-y-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/app/clubs/${linkName}`}>
                <ArrowLeft />
                Club
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
                Recently unlocked
              </h1>
              <p className="mt-1 text-sm text-faint">
                {clubQuery.data?.club.title ?? `/${linkName}`}
              </p>
            </div>
          </div>
          {forwardUnlock?.unlockedAt ? (
            <div className="rounded-lg border border-default bg-inset px-3 py-2 text-sm text-muted">
              Milestones {forwardUnlock.fromPosition + 1}-
              {forwardUnlock.toPosition}
            </div>
          ) : null}
        </section>

        {recentlyUnlockedQuery.isPending ? (
          <RecentlyUnlockedLoading />
        ) : recentlyUnlockedQuery.isError ? (
          <RecentlyUnlockedError
            error={recentlyUnlockedQuery.error}
            onRetry={() => void recentlyUnlockedQuery.refetch()}
          />
        ) : posts.length === 0 ? (
          <RecentlyUnlockedEmpty />
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} linked />
            ))}
          </div>
        )}

        {recentlyUnlockedQuery.hasNextPage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface p-3">
            <p className="text-sm text-muted">
              {countFormatter.format(posts.length)} loaded
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={recentlyUnlockedQuery.isFetchingNextPage}
              onClick={() => void recentlyUnlockedQuery.fetchNextPage()}
            >
              <ChevronDown />
              {recentlyUnlockedQuery.isFetchingNextPage
                ? "Loading..."
                : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </AuthenticatedAppShell>
  );
};

const RecentlyUnlockedLoading = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index}>
        <CardHeader className="space-y-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const RecentlyUnlockedEmpty = () => (
  <Card>
    <CardContent className="flex min-h-56 flex-col justify-center gap-3">
      <Sparkles className="size-8 text-faint" />
      <div>
        <h2 className="text-base font-semibold text-primary">
          Nothing newly unlocked
        </h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
          New discussions will appear here after a forward progress update.
        </p>
      </div>
    </CardContent>
  </Card>
);

const RecentlyUnlockedError = ({
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
      <CardContent className="flex min-h-56 flex-col justify-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
          {isDenied ? (
            <LockKeyhole className="size-5" />
          ) : (
            <MessageSquareText className="size-5" />
          )}
        </span>
        <div>
          <h2 className="text-base font-semibold text-primary">
            {isDenied
              ? "Recently unlocked unavailable"
              : "Could not load recently unlocked"}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
            {isDenied
              ? "This club is unavailable from your account."
              : "Refresh this page and try again."}
          </p>
        </div>
        {isDenied ? null : (
          <Button className="w-fit" variant="secondary" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
