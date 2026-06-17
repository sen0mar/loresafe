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
  getVisibleClubBySlug: (
    slug: string,
    userId: string
  ) => Promise<ClubResponse>;
  joinPublicClubBySlug: (
    slug: string,
    userId: string
  ) => Promise<ClubResponse>;
  listClubMembersBySlug: (
    slug: string,
    userId: string,
    query: ListClubMembersQuery
  ) => Promise<ClubMembersResponse>;
  updateClubMemberRole: (
    slug: string,
    membershipId: string,
    userId: string,
    role: "OWNER" | "MODERATOR" | "MEMBER"
  ) => Promise<ClubMemberResponse>;
  banClubMember: (
    slug: string,
    membershipId: string,
    userId: string,
    input: BanClubMemberRequest
  ) => Promise<ClubMemberResponse>;
  unbanClubMember: (
    slug: string,
    membershipId: string,
    userId: string
  ) => Promise<ClubMemberResponse>;
  listPublicClubs: (
    query: ListClubsQuery
  ) => Promise<ClubsDiscoveryResponse>;
};

export const createClubsService = (
  repository: ClubsRepository = clubsRepository
): ClubsService => ({
  createClub: async (userId, input) => {
    const existingClub = await repository.findClubBySlug(input.slug);

    if (existingClub) {
      throw duplicateSlugError();
    }

    try {
      const club = await repository.createClubWithOwnerMembership(userId, input);

      return {
        club: toClubDto(club)
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicateSlugError();
      }

      throw error;
    }
  },

  getVisibleClubBySlug: async (slug, userId) => {
    const club = await repository.findVisibleClubBySlugForUser(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    return {
      club: toClubDto(club)
    };
  },

  joinPublicClubBySlug: async (slug, userId) => {
    const result = await repository.joinPublicClubBySlug(slug, userId);

    switch (result.status) {
      case "SUCCESS":
        return {
          club: toClubDto(result.club)
        };
      case "NOT_FOUND":
        throw new HttpError(404, "NOT_FOUND", "Club not found");
      case "BANNED":
        throw new HttpError(403, "FORBIDDEN", "You cannot join this club.");
    }
  },

  listClubMembersBySlug: async (slug, userId, query) => {
    const result = await repository.listClubMembersBySlug(slug, userId, query);

    if (!result.club || !result.club.currentUserRole) {
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

  updateClubMemberRole: async (slug, membershipId, userId, role) => {
    const result = await repository.updateClubMemberRole(
      slug,
      membershipId,
      userId,
      role
    );

    return toMemberMutationResponse(result);
  },

  banClubMember: async (slug, membershipId, userId, input) => {
    const result = await repository.banClubMember(
      slug,
      membershipId,
      userId,
      input
    );

    return toMemberMutationResponse(result);
  },

  unbanClubMember: async (slug, membershipId, userId) => {
    const result = await repository.unbanClubMember(slug, membershipId, userId);

    return toMemberMutationResponse(result);
  },

  listPublicClubs: async (query) => {
    const result = await repository.listPublicClubs(query);

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

const duplicateSlugError = () =>
  new HttpError(409, "CONFLICT", "That club slug is already taken.");

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
