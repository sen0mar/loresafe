import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/shared/api/api-client";
import type { ClubCategory } from "@/features/clubs/api/clubs";

export type PublicClub = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverUrl: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicClubDetail = PublicClub & {
  rules: string | null;
};

export type PublicClubsResponse = {
  clubs: PublicClub[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type PublicClubResponse = {
  club: PublicClubDetail;
};

export type PublicClubsQueryInput = {
  limit?: number;
  page?: number;
  sort?: "newest" | "popular";
};

export const publicClubsQueryKeys = {
  all: ["public-clubs"] as const,
  list: (input: PublicClubsQueryInput) =>
    [...publicClubsQueryKeys.all, "list", input] as const,
  detail: (linkName: string | undefined) =>
    [...publicClubsQueryKeys.all, "detail", linkName] as const
};

export const usePublicSeoClubsQuery = (input: PublicClubsQueryInput) =>
  useQuery({
    queryKey: publicClubsQueryKeys.list(input),
    queryFn: () => apiGet<PublicClubsResponse>(getPublicClubsPath(input))
  });

export const usePublicSeoClubQuery = (linkName: string | undefined) =>
  useQuery({
    enabled: !!linkName,
    queryKey: publicClubsQueryKeys.detail(linkName),
    queryFn: () =>
      apiGet<PublicClubResponse>(
        `/api/public/clubs/${encodeURIComponent(linkName ?? "")}`
      )
  });

const getPublicClubsPath = (input: PublicClubsQueryInput) => {
  const params = new URLSearchParams();

  setParam(params, "sort", input.sort);
  setParam(params, "page", input.page?.toString());
  setParam(params, "limit", input.limit?.toString());

  const query = params.toString();

  return query ? `/api/public/clubs?${query}` : "/api/public/clubs";
};

const setParam = (
  params: URLSearchParams,
  key: string,
  value: string | undefined
) => {
  if (value) {
    params.set(key, value);
  }
};
