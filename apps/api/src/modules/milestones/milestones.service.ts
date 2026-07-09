import { HttpError } from "../../core/errors/http-error.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import {
  type CreateMilestoneTemplateResponse,
  type CreateMilestoneResponse,
  type MoveMilestoneResponse,
  type MilestonesResponse,
  type UpdateMilestoneResponse,
  toMilestoneDto
} from "./milestones.dto.js";
import { generateMilestoneTemplateRows } from "./milestone-templates.js";
import { canCreateClubMilestone } from "./milestones.policy.js";
import {
  MilestoneAuthorizationChangedError,
  MilestoneTemplateConflictError,
  MilestoneMoveConflictError,
  milestonesRepository,
  type MilestonesRepository
} from "./milestones.repository.js";
import type {
  CreateMilestoneRequest,
  CreateMilestoneTemplateRequest,
  ListMilestonesQuery,
  MoveMilestoneRequest,
  UpdateMilestoneRequest
} from "./milestones.schema.js";

const templateConflictMessage =
  "Templates can only be generated for an empty timeline.";
const manageMilestonesMessage =
  "Only club owners and moderators can manage milestones.";
const timelineChangedMessage = "The milestone timeline changed. Try again.";

export type MilestonesService = {
  createMilestoneTemplateForClubLinkName: (
    linkName: string,
    userId: string,
    input: CreateMilestoneTemplateRequest
  ) => Promise<CreateMilestoneTemplateResponse>;
  createMilestoneForClubLinkName: (
    linkName: string,
    userId: string,
    input: CreateMilestoneRequest
  ) => Promise<CreateMilestoneResponse>;
  updateMilestoneForClubLinkName: (
    linkName: string,
    milestoneId: string,
    userId: string,
    input: UpdateMilestoneRequest
  ) => Promise<UpdateMilestoneResponse>;
  moveMilestoneForClubLinkName: (
    linkName: string,
    milestoneId: string,
    userId: string,
    input: MoveMilestoneRequest
  ) => Promise<MoveMilestoneResponse>;
  listMilestonesByClubLinkName: (
    linkName: string,
    userId: string,
    query: ListMilestonesQuery
  ) => Promise<MilestonesResponse>;
};

export const createMilestonesService = (
  repository: MilestonesRepository = milestonesRepository
): MilestonesService => ({
  createMilestoneTemplateForClubLinkName: async (linkName, userId, input) => {
    const club = await repository.findClubForMilestoneCreation(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
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
        actorId: userId,
        ...input,
        milestones: generateMilestoneTemplateRows(
          input.template,
          input.count,
          input.safeTitles
        )
      });

      return {
        milestones: milestones.map((milestone) => toMilestoneDto(milestone))
      };
    } catch (error) {
      if (error instanceof MilestoneTemplateConflictError) {
        throw new HttpError(409, "CONFLICT", templateConflictMessage);
      }

      if (error instanceof MilestoneAuthorizationChangedError) {
        throw new HttpError(403, "FORBIDDEN", manageMilestonesMessage);
      }

      throw error;
    }
  },

  createMilestoneForClubLinkName: async (linkName, userId, input) => {
    const club = await repository.findClubForMilestoneCreation(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canCreateClubMilestone(club.currentUserRole)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only club owners and moderators can add milestones."
      );
    }

    const milestone = await runAuthorizedMilestoneWrite(() =>
      repository.createMilestoneAtNextPosition({
        clubId: club.id,
        actorId: userId,
        ...input
      })
    );

    return {
      milestone: toMilestoneDto(milestone)
    };
  },

  updateMilestoneForClubLinkName: async (linkName, milestoneId, userId, input) => {
    const club = await repository.findClubForMilestoneCreation(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canCreateClubMilestone(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", manageMilestonesMessage);
    }

    const milestone = await runAuthorizedMilestoneWrite(() =>
      repository.updateMilestoneForClub({
        clubId: club.id,
        actorId: userId,
        milestoneId,
        ...input
      })
    );

    if (!milestone) {
      throw new HttpError(404, "NOT_FOUND", "Milestone not found");
    }

    return {
      milestone: toMilestoneDto(milestone)
    };
  },

  moveMilestoneForClubLinkName: async (linkName, milestoneId, userId, input) => {
    const club = await repository.findClubForMilestoneCreation(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canCreateClubMilestone(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", manageMilestonesMessage);
    }

    try {
      const milestones = await repository.moveMilestoneForClub({
        clubId: club.id,
        actorId: userId,
        milestoneId,
        direction: input.direction
      });

      if (!milestones) {
        throw new HttpError(404, "NOT_FOUND", "Milestone not found");
      }

      return {
        milestones: milestones.map((milestone) => toMilestoneDto(milestone))
      };
    } catch (error) {
      if (error instanceof MilestoneMoveConflictError) {
        throw new HttpError(409, "CONFLICT", timelineChangedMessage);
      }

      if (error instanceof MilestoneAuthorizationChangedError) {
        throw new HttpError(403, "FORBIDDEN", manageMilestonesMessage);
      }

      throw error;
    }
  },

  listMilestonesByClubLinkName: async (linkName, userId, query) => {
    const result = await repository.listVisibleMilestonesByClubLinkName(
      linkName,
      userId,
      query
    );

    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (result.status === "BANNED") {
      throw bannedFromClubError();
    }

    return {
      milestones: result.milestones.map((milestone) =>
        toMilestoneDto(milestone, result.viewerProgress)
      ),
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

const runAuthorizedMilestoneWrite = async <Result>(
  write: () => Promise<Result>
) => {
  try {
    return await write();
  } catch (error) {
    if (error instanceof MilestoneAuthorizationChangedError) {
      throw new HttpError(403, "FORBIDDEN", manageMilestonesMessage);
    }

    throw error;
  }
};
