import type { ProgressMode } from "../progress/progress.schema.js";

export type ProgressCompletionInput = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
  totalMilestones: number;
};

export type MilestoneVisibilityInput = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
  requiredMilestonePosition: number;
};

export const getCompletedMilestoneCount = ({
  mode,
  currentMilestonePosition,
  totalMilestones
}: ProgressCompletionInput) => {
  if (mode === "FINISHED") {
    return totalMilestones;
  }

  return currentMilestonePosition ?? 0;
};

export const canViewRequiredMilestone = ({
  currentMilestonePosition,
  requiredMilestonePosition
}: MilestoneVisibilityInput) =>
  requiredMilestonePosition <= (currentMilestonePosition ?? 0);
