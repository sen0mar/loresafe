type DisplayMilestone = {
  fullTitle?: string | null;
  position: number;
  safeTitle: string;
};

export const getMilestoneDisplayTitle = (milestone: DisplayMilestone) =>
  milestone.fullTitle ?? milestone.safeTitle;

export const formatMilestoneOption = (milestone: DisplayMilestone) =>
  `${milestone.position}. ${getMilestoneDisplayTitle(milestone)}`;
