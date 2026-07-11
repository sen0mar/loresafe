import { progressRepository } from "./progress.repository.js";
import type { ProgressRepository } from "./progress.repository.types.js";

export type ProgressCommandRepository = Pick<
  ProgressRepository,
  "advanceProgressToNextMilestoneForUserClub" | "updateProgressForUserClub"
>;

export const progressCommandRepository: ProgressCommandRepository = {
  advanceProgressToNextMilestoneForUserClub:
    progressRepository.advanceProgressToNextMilestoneForUserClub,
  updateProgressForUserClub: progressRepository.updateProgressForUserClub
};
