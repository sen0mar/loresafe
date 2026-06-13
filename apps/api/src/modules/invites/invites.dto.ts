import { type ClubDto, toClubDto } from "../clubs/clubs.dto.js";
import type {
  AcceptInviteSuccessRecord,
  ClubInviteRecord
} from "./invites.repository.js";

export type ClubInviteDto = {
  token: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  revokedAt: string | null;
  createdAt: string;
  club: {
    id: string;
    title: string;
    slug: string;
  };
};

export type CreateClubInviteResponse = {
  invite: ClubInviteDto;
};

export type AcceptInviteResponse = {
  status: "accepted" | "already_member";
  club: ClubDto;
};

export const toClubInviteDto = (
  invite: ClubInviteRecord,
  token: string
): ClubInviteDto => ({
  token,
  expiresAt: invite.expiresAt.toISOString(),
  maxUses: invite.maxUses,
  usedCount: invite.usedCount,
  revokedAt: invite.revokedAt?.toISOString() ?? null,
  createdAt: invite.createdAt.toISOString(),
  club: invite.club
});

export const toAcceptInviteResponse = (
  result: AcceptInviteSuccessRecord
): AcceptInviteResponse => ({
  status: result.status,
  club: toClubDto(result.club)
});
