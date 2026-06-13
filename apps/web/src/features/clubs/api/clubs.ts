import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/shared/api/api-client";

export type ClubDiscoveryClub = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClubsDiscoveryResponse = {
  clubs: ClubDiscoveryClub[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export const clubsQueryKeys = {
  discovery: ["clubs", "discovery"] as const
};

export const getPublicClubs = () =>
  apiGet<ClubsDiscoveryResponse>("/api/clubs");

export const usePublicClubsQuery = () =>
  useQuery({
    queryKey: clubsQueryKeys.discovery,
    queryFn: getPublicClubs
  });
