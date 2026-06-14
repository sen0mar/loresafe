import { HttpError } from "../../core/errors/http-error.js";
import {
  type MilestonesResponse,
  toMilestoneDto
} from "./milestones.dto.js";
import {
  milestonesRepository,
  type MilestonesRepository
} from "./milestones.repository.js";
import type { ListMilestonesQuery } from "./milestones.schema.js";

export type MilestonesService = {
  listMilestonesByClubSlug: (
    slug: string,
    userId: string,
    query: ListMilestonesQuery
  ) => Promise<MilestonesResponse>;
};

export const createMilestonesService = (
  repository: MilestonesRepository = milestonesRepository
): MilestonesService => ({
  listMilestonesByClubSlug: async (slug, userId, query) => {
    const result = await repository.listVisibleMilestonesByClubSlug(
      slug,
      userId,
      query
    );

    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    return {
      milestones: result.milestones.map(toMilestoneDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  }
});

export const milestonesService = createMilestonesService();
