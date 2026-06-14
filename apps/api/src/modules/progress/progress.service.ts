import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubProgressResponse,
  toClubProgressDto
} from "./progress.dto.js";
import {
  progressRepository,
  type ProgressRepository
} from "./progress.repository.js";
import type { UpdateProgressRequest } from "./progress.schema.js";
import { canReadClubProgress, canUpdateClubProgress } from "./progress.policy.js";

const membershipRequiredMessage =
  "Join this club before updating your progress.";

export type ProgressService = {
  advanceProgressToNextMilestoneForClubSlug: (
    slug: string,
    userId: string
  ) => Promise<ClubProgressResponse>;
  getProgressForClubSlug: (
    slug: string,
    userId: string
  ) => Promise<ClubProgressResponse>;
  updateProgressForClubSlug: (
    slug: string,
    userId: string,
    input: UpdateProgressRequest
  ) => Promise<ClubProgressResponse>;
};

export const createProgressService = (
  repository: ProgressRepository = progressRepository
): ProgressService => ({
  advanceProgressToNextMilestoneForClubSlug: async (slug, userId) => {
    const club = await repository.findClubForProgress(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canUpdateClubProgress(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", membershipRequiredMessage);
    }

    const progress = await repository.advanceProgressToNextMilestoneForUserClub(
      userId,
      club.id
    );

    return {
      progress: toClubProgressDto(progress)
    };
  },

  getProgressForClubSlug: async (slug, userId) => {
    const club = await repository.findClubForProgress(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canReadClubProgress(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const progress = await repository.getProgressForUserClub(userId, club.id);

    return {
      progress: toClubProgressDto(progress)
    };
  },

  updateProgressForClubSlug: async (slug, userId, input) => {
    const club = await repository.findClubForProgress(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canUpdateClubProgress(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", membershipRequiredMessage);
    }

    const progress = await repository.updateProgressForUserClub(
      userId,
      club.id,
      input
    );

    if (!progress) {
      throw new HttpError(400, "BAD_REQUEST", "Choose a club milestone.");
    }

    return {
      progress: toClubProgressDto(progress)
    };
  }
});

export const progressService = createProgressService();
