import { progressRepository, type ProgressRepository } from "./progress.repository.js";

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
