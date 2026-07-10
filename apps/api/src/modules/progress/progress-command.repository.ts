import { progressRepository, type ProgressRepository } from "./progress.repository.js";

export type ProgressCommandRepository = Pick<
  ProgressRepository,
  "advanceProgressToNextMilestoneForUserClub" | "updateProgressForUserClub"
>;

export const progressCommandRepository: ProgressCommandRepository = {
  advanceProgressToNextMilestoneForUserClub:
    progressRepository.advanceProgressToNextMilestoneForUserClub,
  updateProgressForUserClub: progressRepository.updateProgressForUserClub
};
