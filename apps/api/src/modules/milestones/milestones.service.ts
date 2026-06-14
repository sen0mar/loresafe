import { HttpError } from "../../core/errors/http-error.js";
import {
  type CreateMilestoneTemplateResponse,
  type CreateMilestoneResponse,
  type MilestonesResponse,
  toMilestoneDto
} from "./milestones.dto.js";
import { generateMilestoneTemplateRows } from "./milestone-templates.js";
import { canCreateClubMilestone } from "./milestones.policy.js";
import {
  MilestoneTemplateConflictError,
  milestonesRepository,
  type MilestonesRepository
} from "./milestones.repository.js";
import type {
  CreateMilestoneRequest,
  CreateMilestoneTemplateRequest,
  ListMilestonesQuery
} from "./milestones.schema.js";

const templateConflictMessage =
  "Templates can only be generated for an empty timeline.";

export type MilestonesService = {
  createMilestoneTemplateForClubSlug: (
    slug: string,
    userId: string,
    input: CreateMilestoneTemplateRequest
  ) => Promise<CreateMilestoneTemplateResponse>;
  createMilestoneForClubSlug: (
    slug: string,
    userId: string,
    input: CreateMilestoneRequest
  ) => Promise<CreateMilestoneResponse>;
  listMilestonesByClubSlug: (
    slug: string,
    userId: string,
    query: ListMilestonesQuery
  ) => Promise<MilestonesResponse>;
};

export const createMilestonesService = (
  repository: MilestonesRepository = milestonesRepository
): MilestonesService => ({
  createMilestoneTemplateForClubSlug: async (slug, userId, input) => {
    const club = await repository.findClubForMilestoneCreation(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canCreateClubMilestone(club.currentUserRole)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only club owners and moderators can add milestones."
      );
    }

    try {
      const milestones = await repository.createMilestonesFromTemplateIfEmpty({
        clubId: club.id,
        ...input,
        milestones: generateMilestoneTemplateRows(input.template, input.count)
      });

      return {
        milestones: milestones.map(toMilestoneDto)
      };
    } catch (error) {
      if (error instanceof MilestoneTemplateConflictError) {
        throw new HttpError(409, "CONFLICT", templateConflictMessage);
      }

      throw error;
    }
  },

  createMilestoneForClubSlug: async (slug, userId, input) => {
    const club = await repository.findClubForMilestoneCreation(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canCreateClubMilestone(club.currentUserRole)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only club owners and moderators can add milestones."
      );
    }

    const milestone = await repository.createMilestoneAtNextPosition({
      clubId: club.id,
      ...input
    });

    return {
      milestone: toMilestoneDto(milestone)
    };
  },

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
