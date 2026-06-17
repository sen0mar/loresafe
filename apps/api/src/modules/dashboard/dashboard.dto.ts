import { getCompletedMilestoneCount } from "../spoilers/spoiler.policy.js";
import {
  type ClubPostCardDto,
  toClubPostCardDto
} from "../posts/posts.dto.js";
import type { ClubPostRecord } from "../posts/posts.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { ObjectStorage } from "../../core/storage/r2-storage.js";
import type {
  ClubDashboardStatsRecord,
  PopularDiscussionRecord,
  ProgressSummaryRecord,
  RecentlyUnlockedSummaryRecord
} from "./dashboard.repository.js";

export type ClubDashboardStatsResponse = {
  stats: {
    memberCount: number;
    milestoneCount: number;
    visiblePostCount: number;
    visibleCommentCount: number;
    postReactionCount: number;
    safePostCount: number;
    lockedPostCount: number;
  };
};

export type ProgressSummaryResponse = {
  progress: {
    mode: ProgressMode;
    currentMilestone: {
      id: string;
      position: number;
      label: string;
    } | null;
    totalMilestones: number;
    completedMilestones: number;
    percentage: number;
    updatedAt: string | null;
  };
};

export type PopularDiscussionsResponse = {
  discussions: Array<{
    post: ClubPostCardDto;
    engagementScore: number;
  }>;
  pagination: {
    limit: number;
  };
};

export type RecentlyUnlockedSummaryResponse = {
  unlock: {
    historyId: string | null;
    fromPosition: number;
    toPosition: number;
    unlockedAt: string | null;
  };
  posts: ClubPostCardDto[];
  pagination: {
    limit: number;
  };
};

export const toClubDashboardStatsResponse = (
  record: ClubDashboardStatsRecord
): ClubDashboardStatsResponse => ({
  stats: {
    memberCount: record.memberCount,
    milestoneCount: record.milestoneCount,
    visiblePostCount: record.visiblePostCount,
    visibleCommentCount: record.visibleCommentCount,
    postReactionCount: record.postReactionCount,
    safePostCount: record.safePostCount,
    lockedPostCount: record.lockedPostCount
  }
});

export const toProgressSummaryResponse = (
  record: ProgressSummaryRecord
): ProgressSummaryResponse => {
  const completedMilestones = getCompletedMilestoneCount({
    mode: record.mode,
    currentMilestonePosition: record.currentMilestone?.position ?? null,
    totalMilestones: record.totalMilestones
  });
  const percentage =
    record.totalMilestones === 0
      ? 0
      : Math.min(
          100,
          Math.round((completedMilestones / record.totalMilestones) * 100)
        );

  return {
    progress: {
      mode: record.mode,
      currentMilestone: record.currentMilestone
        ? {
            id: record.currentMilestone.id,
            position: record.currentMilestone.position,
            label: record.currentMilestone.safeTitle
          }
        : null,
      totalMilestones: record.totalMilestones,
      completedMilestones,
      percentage,
      updatedAt: record.updatedAt?.toISOString() ?? null
    }
  };
};

export const toPopularDiscussionsResponse = async (
  records: PopularDiscussionRecord[],
  context: { mode: ProgressMode; currentMilestonePosition: number | null },
  limit: number,
  storage: Pick<ObjectStorage, "createPresignedRead">
): Promise<PopularDiscussionsResponse> => ({
  discussions: await Promise.all(
    records.map(async (record) => ({
      post: await toClubPostCardDto(record.post, context, storage),
      engagementScore: record.engagementScore
    }))
  ),
  pagination: {
    limit
  }
});

export const toRecentlyUnlockedSummaryResponse = async (
  record: RecentlyUnlockedSummaryRecord,
  limit: number,
  storage: Pick<ObjectStorage, "createPresignedRead">
): Promise<RecentlyUnlockedSummaryResponse> => ({
  unlock: {
    historyId: record.unlock.historyId,
    fromPosition: record.unlock.fromPosition,
    toPosition: record.unlock.toPosition,
    unlockedAt: record.unlock.unlockedAt?.toISOString() ?? null
  },
  posts: await Promise.all(
    record.posts.map((post: ClubPostRecord) =>
      toClubPostCardDto(post, record.currentProgress, storage)
    )
  ),
  pagination: {
    limit
  }
});
