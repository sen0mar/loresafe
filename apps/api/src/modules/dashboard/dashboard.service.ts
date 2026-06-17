import { HttpError } from "../../core/errors/http-error.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";
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
    slug: string,
    userId: string
  ) => Promise<ClubDashboardStatsResponse>;
  getPopularDiscussions: (
    slug: string,
    userId: string,
    query: PopularDiscussionsQuery
  ) => Promise<PopularDiscussionsResponse>;
  getProgressSummary: (
    slug: string,
    userId: string
  ) => Promise<ProgressSummaryResponse>;
  getRecentlyUnlockedSummary: (
    slug: string,
    userId: string,
    query: RecentlyUnlockedSummaryQuery
  ) => Promise<RecentlyUnlockedSummaryResponse>;
};

export const createDashboardService = (
  repository: DashboardRepository = dashboardRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = r2Storage
): DashboardService => ({
  getClubStats: async (slug, userId) => {
    const club = await findVisibleDashboardClub(repository, slug, userId);
    const stats = await repository.getClubDashboardStats(userId, club);

    return toClubDashboardStatsResponse(stats);
  },

  getPopularDiscussions: async (slug, userId, query) => {
    const club = await findVisibleDashboardClub(repository, slug, userId);
    const discussions = await repository.getPopularDiscussions(
      userId,
      club.id,
      query.limit
    );

    return toPopularDiscussionsResponse(
      discussions,
      club.progress,
      query.limit,
      storage
    );
  },

  getProgressSummary: async (slug, userId) => {
    const club = await findVisibleDashboardClub(repository, slug, userId);

    if (!canReadClubProgress(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const progress = await repository.getProgressSummary(userId, club.id);

    return toProgressSummaryResponse(progress);
  },

  getRecentlyUnlockedSummary: async (slug, userId, query) => {
    const club = await findVisibleDashboardClub(repository, slug, userId);

    if (!canReadClubProgress(club.currentUserRole)) {
      throw new HttpError(403, "FORBIDDEN", "Join this club to view progress.");
    }

    const summary = await repository.getRecentlyUnlockedSummary(
      userId,
      club.id,
      query.limit
    );

    return toRecentlyUnlockedSummaryResponse(summary, query.limit, storage);
  }
});

export const dashboardService = createDashboardService();

const findVisibleDashboardClub = async (
  repository: DashboardRepository,
  slug: string,
  userId: string
) => {
  const club = await repository.findClubForDashboard(slug, userId);

  if (!club || !canViewClubFeed(club)) {
    throw new HttpError(404, "NOT_FOUND", "Club not found");
  }

  return club;
};
