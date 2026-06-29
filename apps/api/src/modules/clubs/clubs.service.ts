import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubResponse,
  type ClubMemberResponse,
  type ClubMembersResponse,
  type ClubsDiscoveryResponse,
  toClubDto,
  toClubDiscoveryDto,
  toClubMemberDto
} from "./clubs.dto.js";
import {
  clubsRepository,
  type ClubMemberMutationResult,
  isUniqueConstraintError,
  type ClubsRepository
} from "./clubs.repository.js";
import { bannedFromClubError } from "./club-bans.js";
import type {
  BanClubMemberRequest,
  CreateClubRequest,
  ListClubMembersQuery,
  ListClubsQuery
} from "./clubs.schema.js";

export type ClubsService = {
  createClub: (
    userId: string,
    input: CreateClubRequest
  ) => Promise<ClubResponse>;
  getVisibleClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<ClubResponse>;
  joinPublicClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<ClubResponse>;
  listClubMembersByLinkName: (
    linkName: string,
    userId: string,
    query: ListClubMembersQuery
  ) => Promise<ClubMembersResponse>;
  updateClubMemberRole: (
    linkName: string,
    membershipId: string,
    userId: string,
    role: "OWNER" | "MODERATOR" | "MEMBER"
  ) => Promise<ClubMemberResponse>;
  banClubMember: (
    linkName: string,
    membershipId: string,
    userId: string,
    input: BanClubMemberRequest
  ) => Promise<ClubMemberResponse>;
  unbanClubMember: (
    linkName: string,
    membershipId: string,
    userId: string
  ) => Promise<ClubMemberResponse>;
  listPublicClubs: (
    userId: string,
    query: ListClubsQuery
  ) => Promise<ClubsDiscoveryResponse>;
};

export const createClubsService = (
  repository: ClubsRepository = clubsRepository
): ClubsService => ({
  createClub: async (userId, input) => {
    const existingClub = await repository.findClubByLinkName(input.linkName);

    if (existingClub) {
      throw duplicateLinkNameError();
    }

    try {
      const club = await repository.createClubWithOwnerMembership(userId, input);

      return {
        club: toClubDto(club)
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicateLinkNameError();
      }

      throw error;
    }
  },

  getVisibleClubByLinkName: async (linkName, userId) => {
    const club = await repository.findVisibleClubByLinkNameForUser(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    return {
      club: toClubDto(club)
    };
  },

  joinPublicClubByLinkName: async (linkName, userId) => {
    const result = await repository.joinPublicClubByLinkName(linkName, userId);

    switch (result.status) {
      case "SUCCESS":
        return {
          club: toClubDto(result.club)
        };
      case "NOT_FOUND":
        throw new HttpError(404, "NOT_FOUND", "Club not found");
      case "BANNED":
        throw bannedFromClubError();
    }
  },

  listClubMembersByLinkName: async (linkName, userId, query) => {
    const result = await repository.listClubMembersByLinkName(linkName, userId, query);

    if (!result.club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (result.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!result.club.currentUserRole) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    return {
      members: result.members.map(toClubMemberDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  },

  updateClubMemberRole: async (linkName, membershipId, userId, role) => {
    const result = await repository.updateClubMemberRole(
      linkName,
      membershipId,
      userId,
      role
    );

    return toMemberMutationResponse(result);
  },

  banClubMember: async (linkName, membershipId, userId, input) => {
    const result = await repository.banClubMember(
      linkName,
      membershipId,
      userId,
      input
    );

    return toMemberMutationResponse(result);
  },

  unbanClubMember: async (linkName, membershipId, userId) => {
    const result = await repository.unbanClubMember(linkName, membershipId, userId);

    return toMemberMutationResponse(result);
  },

  listPublicClubs: async (userId, query) => {
    const result = await repository.listPublicClubs(userId, query);

    return {
      clubs: result.clubs.map(toClubDiscoveryDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  }
});

export const clubsService = createClubsService();

const duplicateLinkNameError = () =>
  new HttpError(409, "CONFLICT", "That club link name is already taken.");

const toMemberMutationResponse = (
  result: ClubMemberMutationResult
): ClubMemberResponse => {
  switch (result.status) {
    case "SUCCESS":
      return {
        member: toClubMemberDto(result.member)
      };
    case "CLUB_NOT_FOUND":
    case "MEMBER_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Club member not found");
    case "ACTOR_BANNED":
      throw bannedFromClubError();
    case "ACTOR_NOT_ALLOWED":
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You cannot manage this club member."
      );
    case "LAST_OWNER":
      throw new HttpError(
        409,
        "CONFLICT",
        "This club must keep at least one owner."
      );
  }
};
