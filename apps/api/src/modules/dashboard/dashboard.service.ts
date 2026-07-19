import { HttpError } from "../../core/errors/http-error.js";
import {
  r2Storage,
  type ObjectStorage
} from "../../core/storage/r2-storage.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import { canViewClubFeed } from "../posts/posts.policy.js";
import { canReadClubProgress } from "../progress/progress.policy.js";
import {
  type ClubDashboardStatsResponse,
  type PopularDiscussionsResponse,
  type ProgressSummaryResponse,
  type RecentlyUnlockedSummaryResponse,
  toClubDashboardStatsResponse,
  toPopularDiscussionsResponse,
  toProgressSummaryResponse,
  toRecentlyUnlockedSummaryResponse
} from "./dashboard.dto.js";
import {
  dashboardRepository,
  type DashboardRepository
} from "./dashboard.repository.js";
import type {
  PopularDiscussionsQuery,
  RecentlyUnlockedSummaryQuery
} from "./dashboard.schema.js";

export type DashboardService = {
  getClubStats: (
    linkName: string,
    userId: string
  ) => Promise<ClubDashboardStatsResponse>;
  getPopularDiscussions: (
    linkName: string,
    userId: string,
    query: PopularDiscussionsQuery
  ) => Promise<PopularDiscussionsResponse>;
  getProgressSummary: (
    linkName: string,
    userId: string
  ) => Promise<ProgressSummaryResponse>;
  getRecentlyUnlockedSummary: (
    linkName: string,
    userId: string,
    query: RecentlyUnlockedSummaryQuery
  ) => Promise<RecentlyUnlockedSummaryResponse>;
};

export const createDashboardService = (
  repository: DashboardRepository = dashboardRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = r2Storage
): DashboardService => ({
  getClubStats: async (linkName, userId) => {
    const club = await findVisibleDashboardClub(repository, linkName, userId);
    const stats = await repository.getClubDashboardStats(userId, club);

    return toClubDashboardStatsResponse(stats);
  },

  getPopularDiscussions: async (linkName, userId, query) => {
    const club = await findVisibleDashboardClub(repository, linkName, userId);
    const discussions = await repository.getPopularDiscussions(
      userId,
      club.id,
      query.limit
    );

    return toPopularDiscussionsResponse(
      discussions,
      userId,
      query.limit,
      storage
    );
  },

  getProgressSummary: async (linkName, userId) => {
    const club = await findVisibleDashboardClub(repository, linkName, userId);

    if (!canReadClubProgress(club)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const progress = await repository.getProgressSummary(userId, club.id);

    return toProgressSummaryResponse(progress);
  },

  getRecentlyUnlockedSummary: async (linkName, userId, query) => {
    const club = await findVisibleDashboardClub(repository, linkName, userId);

    if (!canReadClubProgress(club)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const summary = await repository.getRecentlyUnlockedSummary(
      userId,
      club.id,
      query.limit
    );

    return toRecentlyUnlockedSummaryResponse(
      summary,
      {
        ...summary.currentProgress,
        currentUserId: userId,
        currentUserRole: club.currentUserRole
      },
      query.limit,
      storage
    );
  }
});

export const dashboardService = createDashboardService();

const findVisibleDashboardClub = async (
  repository: DashboardRepository,
  linkName: string,
  userId: string
) => {
  const club = await repository.findClubForDashboard(linkName, userId);

  if (!club) {
    throw new HttpError(404, "NOT_FOUND", "Club not found");
  }

  if (club.isCurrentUserBanned) {
    throw bannedFromClubError();
  }

  if (!canViewClubFeed(club)) {
    throw new HttpError(404, "NOT_FOUND", "Club not found");
  }

  return club;
};
