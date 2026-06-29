import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  type Club,
  clubsQueryKeys
} from "@/features/clubs/api/clubs";
import { apiPost } from "@/shared/api/api-client";

import type { CreateInvitePayload } from "../schemas/invite.schema.js";

export type ClubInvite = {
  token: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  revokedAt: string | null;
  createdAt: string;
  club: {
    id: string;
    title: string;
    linkName: string;
  };
};

export type CreateClubInviteResponse = {
  invite: ClubInvite;
};

export type AcceptInviteResponse = {
  status: "accepted" | "already_member";
  club: Club;
};

export const createClubInvite = (
  linkName: string,
  input: CreateInvitePayload
) =>
  apiPost<CreateClubInviteResponse, CreateInvitePayload>(
    `/api/clubs/${linkName}/invites`,
    input
  );

export const acceptInvite = (token: string) =>
  apiPost<AcceptInviteResponse>(`/api/invites/${token}/accept`);

export const useCreateClubInviteMutation = (linkName: string) =>
  useMutation({
    mutationFn: (input: CreateInvitePayload) => createClubInvite(linkName, input)
  });

export const useAcceptInviteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvite,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.linkName),
        { club: response.club }
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
