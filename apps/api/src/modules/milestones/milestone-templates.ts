import type { MilestoneTemplate } from "./milestones.schema.js";

const templateTitlePrefixes: Record<MilestoneTemplate, string> = {
  BOOK: "Chapter",
  SHOW: "Episode",
  MOVIE: "Part",
  GAME: "Mission",
  PODCAST_COURSE: "Episode",
  CUSTOM: "Checkpoint"
};

export type GeneratedMilestoneTemplate = {
  safeTitle: string;
  fullTitle: null;
  description: null;
  spoilerName: false;
};

export const generateMilestoneTemplateRows = (
  template: MilestoneTemplate,
  count: number
): GeneratedMilestoneTemplate[] => {
  const titlePrefix = templateTitlePrefixes[template];

  return Array.from({ length: count }, (_, index) => ({
    safeTitle: `${titlePrefix} ${index + 1}`,
    fullTitle: null,
    description: null,
    spoilerName: false
  }));
};
