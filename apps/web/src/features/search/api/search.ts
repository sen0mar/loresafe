import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/shared/api/api-client";
import type { ClubPostCard, ClubVisibility } from "@/features/clubs/api/clubs";

export type SearchScope = "all" | "clubs" | "posts";

export type SearchClub = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  visibility: ClubVisibility;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchResponse = {
  query: string;
  scope: SearchScope;
  clubs: SearchClub[];
  posts: ClubPostCard[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export const searchScopes: Array<{ value: SearchScope; label: string }> = [
  {
    value: "all",
    label: "All"
  },
  {
    value: "clubs",
    label: "Clubs"
  },
  {
    value: "posts",
    label: "Discussions"
  }
];

export const searchQueryKeys = {
  root: ["search"] as const,
  results: (query: string, scope: SearchScope) =>
    ["search", "results", query, scope] as const
};

export const getSearchResults = ({
  cursor,
  query,
  scope
}: {
  cursor: string | null;
  query: string;
  scope: SearchScope;
}) => {
  const params = new URLSearchParams({
    q: query,
    scope,
    limit: "10"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<SearchResponse>(`/api/search?${params}`);
};

export const useSearchResultsInfiniteQuery = (
  query: string,
  scope: SearchScope
) =>
  useInfiniteQuery({
    queryKey: searchQueryKeys.results(query, scope),
    queryFn: ({ pageParam }) =>
      getSearchResults({
        query,
        scope,
        cursor: pageParam
      }),
    enabled: query.trim().length > 0,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor
  });
