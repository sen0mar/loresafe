import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/shared/api/api-client";

export type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

export type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

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

export type Club = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  rules: string | null;
  visibility: ClubVisibility;
  memberCount: number;
  currentUserRole: ClubMembershipRole | null;
  membership: {
    isMember: boolean;
    role: ClubMembershipRole | null;
  };
  settings: {
    visibility: ClubVisibility;
    rules: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type JoinedClub = {
  id: string;
  title: string;
  slug: string;
  visibility: ClubVisibility;
  role: ClubMembershipRole;
  memberCount: number;
  joinedAt: string;
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

export type ClubResponse = {
  club: Club;
};

export type JoinedClubsResponse = {
  clubs: JoinedClub[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type CreateClubInput = {
  title: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  visibility: ClubVisibility;
  rules?: string | null;
};

export const clubsQueryKeys = {
  discovery: ["clubs", "discovery"] as const,
  joined: ["users", "me", "clubs"] as const,
  detail: (slug: string) => ["clubs", "detail", slug] as const
};

export const getPublicClubs = () =>
  apiGet<ClubsDiscoveryResponse>("/api/clubs");

export const getClubBySlug = (slug: string) =>
  apiGet<ClubResponse>(`/api/clubs/${slug}`);

export const getJoinedClubs = () =>
  apiGet<JoinedClubsResponse>("/api/users/me/clubs");

export const createClub = (input: CreateClubInput) =>
  apiPost<ClubResponse, CreateClubInput>("/api/clubs", input);

export const joinClub = (slug: string) =>
  apiPost<ClubResponse>(`/api/clubs/${slug}/join`);

export const usePublicClubsQuery = () =>
  useQuery({
    queryKey: clubsQueryKeys.discovery,
    queryFn: getPublicClubs
  });

export const useClubQuery = (slug: string) =>
  useQuery({
    queryKey: clubsQueryKeys.detail(slug),
    queryFn: () => getClubBySlug(slug),
    enabled: slug.length > 0
  });

export const useJoinedClubsQuery = (enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.joined,
    queryFn: getJoinedClubs,
    enabled
  });

export const useCreateClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.slug),
        response
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discovery
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
    }
  });
};

export const useJoinClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.slug),
        response
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discovery
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
    }
  });
};
