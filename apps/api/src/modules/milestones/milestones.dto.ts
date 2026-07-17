import type {
  MilestoneRecord,
  MilestoneViewerProgress
} from "./milestones.repository.js";
import { projectMilestoneSpoilerTitle } from "../spoilers/milestone-title-projection.js";

export type MilestoneDto = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  description: string | null;
  spoilerName: boolean;
  isFullTitleHidden: boolean;
};

export type MilestonesResponse = {
  milestones: MilestoneDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export type CreateMilestoneResponse = {
  milestone: MilestoneDto;
};

export type UpdateMilestoneResponse = {
  milestone: MilestoneDto;
};

export type MoveMilestoneResponse = {
  milestones: MilestoneDto[];
};

export type CreateMilestoneTemplateResponse = {
  milestones: MilestoneDto[];
};

const defaultViewerProgress: MilestoneViewerProgress = {
  mode: "STRICT",
  currentMilestonePosition: null
};

export const toMilestoneDto = (
  milestone: MilestoneRecord,
  viewerProgress: MilestoneViewerProgress = defaultViewerProgress
): MilestoneDto => {
  const spoilerTitle = projectMilestoneSpoilerTitle({
    fullTitle: milestone.fullTitle,
    spoilerName: milestone.spoilerName,
    position: milestone.position,
    mode: viewerProgress.mode,
    currentMilestonePosition: viewerProgress.currentMilestonePosition
  });

  return {
    id: milestone.id,
    position: milestone.position,
    safeTitle: milestone.safeTitle,
    fullTitle: spoilerTitle.fullTitle,
    description: milestone.description,
    spoilerName: milestone.spoilerName,
    isFullTitleHidden: spoilerTitle.isFullTitleHidden
  };
};
