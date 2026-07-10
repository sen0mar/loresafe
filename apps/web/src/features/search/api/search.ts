import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/shared/api/api-client";
import { RETAINED_INFINITE_QUERY_PAGES } from "@/shared/api/infinite-query";
import type {
  ClubCategory,
  ClubPostCard,
  ClubVisibility
} from "@/features/clubs/api/clubs";

export type SearchScope = "all" | "clubs" | "posts";
export type SearchFilter = "safe" | "spoiler" | "clubs" | "posts";

export type SearchClub = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverUrl: string | null;
  visibility: ClubVisibility;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchResponse = {
  query: string;
  scope: SearchScope;
  filters: SearchFilter[];
  clubs: SearchClub[];
  posts: SearchPost[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type SearchPost = {
  post: ClubPostCard;
  club: {
    id: string;
    title: string;
    linkName: string;
  };
};

export const defaultSearchFilters: SearchFilter[] = [
  "safe",
  "spoiler",
  "clubs",
  "posts"
];

export const searchFilters: Array<{ value: SearchFilter; label: string }> = [
  {
    value: "safe",
    label: "Safe"
  },
  {
    value: "spoiler",
    label: "Spoiler"
  },
  {
    value: "clubs",
    label: "Clubs"
  },
  {
    value: "posts",
    label: "Posts"
  }
];

export const searchQueryKeys = {
  root: ["search"] as const,
  results: (query: string, filters: SearchFilter[]) =>
    ["search", "results", query, filters.join(",")] as const
};

export const getSearchResults = ({
  cursor,
  filters,
  query,
  signal
}: {
  cursor: string | null;
  filters: SearchFilter[];
  query: string;
  signal?: AbortSignal;
}) => {
  const params = new URLSearchParams({
    q: query,
    limit: "10"
  });

  if (filters.length > 0) {
    params.set("filters", filters.join(","));
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<SearchResponse>(`/api/search?${params}`, { signal });
};

export const useSearchResultsInfiniteQuery = (
  query: string,
  filters: SearchFilter[]
) =>
  useInfiniteQuery({
    queryKey: searchQueryKeys.results(query, filters),
    queryFn: ({ pageParam, signal }) =>
      getSearchResults({
        query,
        filters,
        cursor: pageParam,
        signal
      }),
    enabled: query.trim().length > 0,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    maxPages: RETAINED_INFINITE_QUERY_PAGES
  });
