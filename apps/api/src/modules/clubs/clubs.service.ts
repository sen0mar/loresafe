import {
  type ClubsDiscoveryResponse,
  toClubDiscoveryDto
} from "./clubs.dto.js";
import {
  clubsRepository,
  type ClubsRepository
} from "./clubs.repository.js";
import type { ListClubsQuery } from "./clubs.schema.js";

export type ClubsService = {
  listPublicClubs: (
    query: ListClubsQuery
  ) => Promise<ClubsDiscoveryResponse>;
};

export const createClubsService = (
  repository: ClubsRepository = clubsRepository
): ClubsService => ({
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
