import type { MilestoneRecord } from "./milestones.repository.js";

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

export const toMilestoneDto = (
  milestone: MilestoneRecord
): MilestoneDto => ({
  id: milestone.id,
  position: milestone.position,
  safeTitle: milestone.safeTitle,
  fullTitle: milestone.spoilerName ? null : milestone.fullTitle,
  description: milestone.description,
  spoilerName: milestone.spoilerName,
  isFullTitleHidden: milestone.spoilerName
});
