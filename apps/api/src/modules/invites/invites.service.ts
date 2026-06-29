import { HttpError } from "../../core/errors/http-error.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import {
  type CreateClubInviteResponse,
  type AcceptInviteResponse,
  toAcceptInviteResponse,
  toClubInviteDto
} from "./invites.dto.js";
import { canCreateClubInvite } from "./invites.policy.js";
import {
  invitesRepository,
  isUniqueConstraintError,
  type InvitesRepository
} from "./invites.repository.js";
import type { CreateClubInviteRequest } from "./invites.schema.js";
import { generateInviteToken, hashInviteToken } from "./invites.token.js";

export type InvitesService = {
  acceptInvite: (
    token: string,
    userId: string
  ) => Promise<AcceptInviteResponse>;
  createClubInvite: (
    linkName: string,
    userId: string,
    input: CreateClubInviteRequest
  ) => Promise<CreateClubInviteResponse>;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const tokenGenerationAttempts = 3;

export const createInvitesService = (
  repository: InvitesRepository = invitesRepository
): InvitesService => ({
  acceptInvite: async (token, userId) => {
    const result = await repository.acceptInviteByTokenHash(
      hashInviteToken(token),
      userId,
      new Date()
    );

    switch (result.status) {
      case "accepted":
      case "already_member":
        return toAcceptInviteResponse(result);
      case "not_found":
        throw new HttpError(404, "NOT_FOUND", "Invite not found");
      case "banned":
        throw bannedFromClubError();
      case "expired":
        throw new HttpError(409, "INVITE_EXPIRED", "This invite has expired.");
      case "revoked":
        throw new HttpError(409, "INVITE_REVOKED", "This invite was revoked.");
      case "maxed":
        throw new HttpError(
          409,
          "INVITE_MAXED",
          "This invite has already been used the maximum number of times."
        );
    }
  },

  createClubInvite: async (linkName, userId, input) => {
    const club = await repository.findClubForInviteCreation(linkName, userId);

    if (!club || !club.currentUserRole) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canCreateClubInvite(club.currentUserRole)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only club owners and moderators can create invites."
      );
    }

    const expiresAt = new Date(
      Date.now() + input.expiresInDays * millisecondsPerDay
    );

    for (let attempt = 0; attempt < tokenGenerationAttempts; attempt += 1) {
      const token = generateInviteToken();

      try {
        const invite = await repository.createClubInvite({
          clubId: club.id,
          createdById: userId,
          tokenHash: hashInviteToken(token),
          expiresAt,
          maxUses: input.maxUses
        });

        return {
          invite: toClubInviteDto(invite, token)
        };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new HttpError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Could not create invite."
    );
  }
});

export const invitesService = createInvitesService();
