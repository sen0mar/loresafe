import { Link } from "react-router-dom";
import {
  Building2,
  LockKeyhole,
  SearchX
} from "lucide-react";

import { ClubAvatar } from "@/features/clubs/components/club-avatar";
import { ClubCardGrid } from "@/features/clubs/components/club-card-grid";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { formatClubCategory } from "@/features/clubs/lib/club-categories";
import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import {
  defaultSearchFilters,
  searchFilters,
  type SearchClub,
  type SearchFilter,
  type SearchPost
} from "../api/search.js";

const countFormatter = new Intl.NumberFormat();
const filterLabelByValue = Object.fromEntries(
  searchFilters.map((filter) => [filter.value, filter.label])
) as Record<SearchFilter, string>;

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
      <ClubCardGrid className="gap-3">
        {clubs.map((club) => (
          <SearchClubCard key={club.id} club={club} />
        ))}
      </ClubCardGrid>
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
      to={getClubFeedPath(result.club.linkName)}
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
              to={getClubFeedPath(club.linkName)}
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
      <ClubCardGrid className="gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
          </Card>
        ))}
      </ClubCardGrid>
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
