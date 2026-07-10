import { HttpError } from "../../core/errors/http-error.js";
import {
  decodeTimestampUuidCursor,
  encodeTimestampUuidCursor
} from "../../core/http/cursor.js";
import {
  type ClubProgressResponse,
  type RecentlyUnlockedResponse,
  toClubProgressDto,
  toRecentlyUnlockedResponse
} from "./progress.dto.js";
import {
  type ProgressRepository,
  type RecentlyUnlockedCursor
} from "./progress.repository.js";
import { progressQueryRepository } from "./progress-query.repository.js";
import { progressCommandRepository } from "./progress-command.repository.js";
import type {
  RecentlyUnlockedQuery,
  UpdateProgressRequest
} from "./progress.schema.js";
import { canReadClubProgress, canUpdateClubProgress } from "./progress.policy.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";
import { bannedFromClubError } from "../clubs/club-bans.js";

const membershipRequiredMessage =
  "Join this club before updating your progress.";

export type ProgressService = {
  advanceProgressToNextMilestoneForClubLinkName: (
    linkName: string,
    userId: string,
    commandId: string
  ) => Promise<ClubProgressResponse>;
  getProgressForClubLinkName: (
    linkName: string,
    userId: string
  ) => Promise<ClubProgressResponse>;
  listRecentlyUnlockedForClubLinkName: (
    linkName: string,
    userId: string,
    query: RecentlyUnlockedQuery
  ) => Promise<RecentlyUnlockedResponse>;
  updateProgressForClubLinkName: (
    linkName: string,
    userId: string,
    input: UpdateProgressRequest,
    commandId: string
  ) => Promise<ClubProgressResponse>;
};

export const createProgressService = (
  repository: ProgressRepository = {
    ...progressQueryRepository,
    ...progressCommandRepository
  },
  storage: Pick<ObjectStorage, "createPresignedRead"> = r2Storage
): ProgressService => ({
  advanceProgressToNextMilestoneForClubLinkName: async (
    linkName,
    userId,
    commandId
  ) => {
    const club = await repository.findClubForProgress(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canUpdateClubProgress(club)) {
      throw new HttpError(403, "FORBIDDEN", membershipRequiredMessage);
    }

    const progress = await repository.advanceProgressToNextMilestoneForUserClub(
      userId,
      club.id,
      commandId
    );

    return {
      progress: toClubProgressDto(progress)
    };
  },

  getProgressForClubLinkName: async (linkName, userId) => {
    const club = await repository.findClubForProgress(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canReadClubProgress(club)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const progress = await repository.getProgressForUserClub(userId, club.id);

    return {
      progress: toClubProgressDto(progress)
    };
  },

  listRecentlyUnlockedForClubLinkName: async (linkName, userId, query) => {
    const club = await repository.findClubForProgress(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canReadClubProgress(club)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const cursor = decodeTimestampUuidCursor(query.cursor);
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
      {
        ...result.currentProgress,
        currentUserId: userId,
        currentUserRole: club.currentUserRole
      },
      query.limit,
      result.nextCursor
        ? encodeTimestampUuidCursor(result.nextCursor)
        : null,
      storage
    );
  },

  updateProgressForClubLinkName: async (
    linkName,
    userId,
    input,
    commandId
  ) => {
    const club = await repository.findClubForProgress(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canUpdateClubProgress(club)) {
      throw new HttpError(403, "FORBIDDEN", membershipRequiredMessage);
    }

    const progress = await repository.updateProgressForUserClub(
      userId,
      club.id,
      input,
      commandId
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
