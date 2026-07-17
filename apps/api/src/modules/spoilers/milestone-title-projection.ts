import type { ProgressMode } from "../progress/progress.schema.js";
import { canViewRequiredMilestone } from "./spoiler.policy.js";

type SpoilerTitleProjectionInput = {
  currentMilestonePosition: number | null;
  fullTitle: string | null;
  mode: ProgressMode;
  position: number;
  spoilerName: boolean;
};

export const projectMilestoneSpoilerTitle = ({
  currentMilestonePosition,
  fullTitle,
  mode,
  position,
  spoilerName
}: SpoilerTitleProjectionInput) => {
  const isFullTitleHidden =
    spoilerName &&
    !canViewRequiredMilestone({
      mode,
      currentMilestonePosition,
      requiredMilestonePosition: position
    });

  return {
    fullTitle: isFullTitleHidden ? null : fullTitle,
    isFullTitleHidden
  };
};
