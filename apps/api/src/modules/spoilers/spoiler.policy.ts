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
  mode,
  currentMilestonePosition,
  requiredMilestonePosition
}: MilestoneVisibilityInput) => {
  if (mode === "FINISHED") {
    return true;
  }

  return requiredMilestonePosition <= (currentMilestonePosition ?? 0);
};

export const canRevealRequiredMilestone = ({
  mode,
  currentMilestonePosition,
  requiredMilestonePosition
}: MilestoneVisibilityInput) =>
  canViewRequiredMilestone({
    mode,
    currentMilestonePosition,
    requiredMilestonePosition
  }) || mode === "BRAVE";
