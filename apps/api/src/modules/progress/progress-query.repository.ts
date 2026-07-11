import { progressRepository } from "./progress.repository.js";
import type { ProgressRepository } from "./progress.repository.types.js";

export type ProgressQueryRepository = Pick<
  ProgressRepository,
  | "findClubForProgress"
  | "getProgressForUserClub"
  | "listRecentlyUnlockedPostsForUserClub"
>;

export const progressQueryRepository: ProgressQueryRepository = {
  findClubForProgress: progressRepository.findClubForProgress,
  getProgressForUserClub: progressRepository.getProgressForUserClub,
  listRecentlyUnlockedPostsForUserClub:
    progressRepository.listRecentlyUnlockedPostsForUserClub
};
