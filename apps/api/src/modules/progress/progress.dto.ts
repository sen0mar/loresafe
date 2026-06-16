import type {
  ClubProgressRecord,
  ProgressHistoryRecord,
  ProgressMilestoneRecord,
  RecentlyUnlockedRecord
} from "./progress.repository.js";
import type { ProgressMode } from "./progress.schema.js";
import { getCompletedMilestoneCount } from "../spoilers/spoiler.policy.js";
import {
  type ClubPostCardDto,
  toClubPostCardDto
} from "../posts/posts.dto.js";

export type ProgressMilestoneDto = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  isFullTitleHidden: boolean;
};

export type ProgressHistoryDto = {
  id: string;
  fromMode: ProgressMode;
  toMode: ProgressMode;
  fromMilestone: ProgressMilestoneDto | null;
  toMilestone: ProgressMilestoneDto | null;
  createdAt: string;
};

export type ClubProgressDto = {
  id: string | null;
  mode: ProgressMode;
  currentMilestone: ProgressMilestoneDto | null;
  totalMilestones: number;
  completedMilestones: number;
  percentage: number;
  updatedAt: string | null;
  history: ProgressHistoryDto[];
};

export type ClubProgressResponse = {
  progress: ClubProgressDto;
};

export type RecentlyUnlockedResponse = {
  unlock: {
    historyId: string | null;
    fromPosition: number;
    toPosition: number;
    unlockedAt: string | null;
  };
  posts: ClubPostCardDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export const toClubProgressDto = (
  progress: ClubProgressRecord
): ClubProgressDto => {
  const completedMilestones = getCompletedMilestoneCount({
    mode: progress.mode,
    currentMilestonePosition: progress.currentMilestone?.position ?? null,
    totalMilestones: progress.totalMilestones
  });
  const percentage =
    progress.totalMilestones === 0
      ? 0
      : Math.min(
          100,
          Math.round((completedMilestones / progress.totalMilestones) * 100)
        );

  return {
    id: progress.id,
    mode: progress.mode,
    currentMilestone: progress.currentMilestone
      ? toProgressMilestoneDto(progress.currentMilestone)
      : null,
    totalMilestones: progress.totalMilestones,
    completedMilestones,
    percentage,
    updatedAt: progress.updatedAt?.toISOString() ?? null,
    history: progress.history.map(toProgressHistoryDto)
  };
};

export const toRecentlyUnlockedResponse = (
  record: RecentlyUnlockedRecord,
  limit: number,
  nextCursor: string | null
): RecentlyUnlockedResponse => ({
  unlock: {
    historyId: record.unlock.historyId,
    fromPosition: record.unlock.fromPosition,
    toPosition: record.unlock.toPosition,
    unlockedAt: record.unlock.unlockedAt?.toISOString() ?? null
  },
  posts: record.posts.map((post) =>
    toClubPostCardDto(post, record.currentProgress)
  ),
  pagination: {
    limit,
    nextCursor,
    hasMore: record.hasMore
  }
});

const toProgressHistoryDto = (
  history: ProgressHistoryRecord
): ProgressHistoryDto => ({
  id: history.id,
  fromMode: history.fromMode,
  toMode: history.toMode,
  fromMilestone: history.fromMilestone
    ? toProgressMilestoneDto(history.fromMilestone)
    : null,
  toMilestone: history.toMilestone
    ? toProgressMilestoneDto(history.toMilestone)
    : null,
  createdAt: history.createdAt.toISOString()
});

const toProgressMilestoneDto = (
  milestone: ProgressMilestoneRecord
): ProgressMilestoneDto => ({
  id: milestone.id,
  position: milestone.position,
  safeTitle: milestone.safeTitle,
  fullTitle: milestone.spoilerName ? null : milestone.fullTitle,
  isFullTitleHidden: milestone.spoilerName
});
