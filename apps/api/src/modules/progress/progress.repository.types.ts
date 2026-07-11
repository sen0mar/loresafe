import type { ClubPostRecord } from "../posts/posts.repository.js";
import type { ProgressMode, UpdateProgressRequest } from "./progress.schema.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ProgressClubRecord = {
  id: string;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
};

export type ProgressMilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  spoilerName: boolean;
};

export type ProgressHistoryRecord = {
  id: string;
  fromMode: ProgressMode;
  toMode: ProgressMode;
  fromMilestone: ProgressMilestoneRecord | null;
  toMilestone: ProgressMilestoneRecord | null;
  createdAt: Date;
};

export type ClubProgressRecord = {
  id: string | null;
  mode: ProgressMode;
  currentMilestone: ProgressMilestoneRecord | null;
  totalMilestones: number;
  history: ProgressHistoryRecord[];
  onboardingCompletedAt: Date | null;
  updatedAt: Date | null;
};

export type RecentlyUnlockedCursor = {
  createdAt: Date;
  id: string;
};

export type RecentlyUnlockedRecord = {
  unlock: {
    historyId: string | null;
    fromPosition: number;
    toPosition: number;
    unlockedAt: Date | null;
  };
  posts: ClubPostRecord[];
  nextCursor: RecentlyUnlockedCursor | null;
  hasMore: boolean;
  currentProgress: {
    mode: ProgressMode;
    currentMilestonePosition: number | null;
  };
};

export type ListRecentlyUnlockedInput = {
  cursor: RecentlyUnlockedCursor | null;
  limit: number;
};

export type ProgressRepository = {
  findClubForProgress: (
    linkName: string,
    userId: string
  ) => Promise<ProgressClubRecord | null>;
  advanceProgressToNextMilestoneForUserClub: (
    userId: string,
    clubId: string,
    commandId: string
  ) => Promise<ClubProgressRecord>;
  getProgressForUserClub: (
    userId: string,
    clubId: string
  ) => Promise<ClubProgressRecord>;
  updateProgressForUserClub: (
    userId: string,
    clubId: string,
    input: UpdateProgressRequest,
    commandId: string
  ) => Promise<ClubProgressRecord | null>;
  listRecentlyUnlockedPostsForUserClub: (
    userId: string,
    clubId: string,
    input: ListRecentlyUnlockedInput
  ) => Promise<RecentlyUnlockedRecord>;
};
