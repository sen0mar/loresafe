import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubProgressResponse,
  type RecentlyUnlockedResponse,
  toClubProgressDto,
  toRecentlyUnlockedResponse
} from "./progress.dto.js";
import {
  progressRepository,
  type ProgressRepository,
  type RecentlyUnlockedCursor
} from "./progress.repository.js";
import type {
  RecentlyUnlockedQuery,
  UpdateProgressRequest
} from "./progress.schema.js";
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
  listRecentlyUnlockedForClubSlug: (
    slug: string,
    userId: string,
    query: RecentlyUnlockedQuery
  ) => Promise<RecentlyUnlockedResponse>;
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

  listRecentlyUnlockedForClubSlug: async (slug, userId, query) => {
    const club = await repository.findClubForProgress(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canReadClubProgress(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const cursor = decodeRecentlyUnlockedCursor(query.cursor);
    const result = await repository.listRecentlyUnlockedPostsForUserClub(
      userId,
      club.id,
      {
        cursor,
        limit: query.limit
      }
    );

    return toRecentlyUnlockedResponse(
      result,
      query.limit,
      result.nextCursor
        ? encodeRecentlyUnlockedCursor(result.nextCursor)
        : null
    );
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

const encodeRecentlyUnlockedCursor = ({
  createdAt,
  id
}: RecentlyUnlockedCursor) =>
  Buffer.from(
    JSON.stringify({
      createdAt: createdAt.toISOString(),
      id
    })
  ).toString("base64url");

const decodeRecentlyUnlockedCursor = (
  cursor: string | undefined
): RecentlyUnlockedCursor | null => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Malformed cursor");
    }

    const createdAt = new Date(parsed.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Malformed cursor");
    }

    return {
      createdAt,
      id: parsed.id
    };
  } catch {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Check the recently unlocked request and try again."
    );
  }
};
