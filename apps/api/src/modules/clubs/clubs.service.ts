import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubResponse,
  type ClubsDiscoveryResponse,
  toClubDto,
  toClubDiscoveryDto
} from "./clubs.dto.js";
import {
  clubsRepository,
  isUniqueConstraintError,
  type ClubsRepository
} from "./clubs.repository.js";
import type {
  CreateClubRequest,
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
    const club = await repository.joinPublicClubBySlug(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    return {
      club: toClubDto(club)
    };
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
