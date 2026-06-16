import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { ReportTargetRecord } from "./reports.repository.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

const canViewClub = (club: {
  visibility: ClubVisibility;
  currentUserRole: string | null;
}) => club.visibility === "PUBLIC" || club.currentUserRole !== null;

export const canReportTarget = (target: ReportTargetRecord) =>
  canViewClub(target.club) &&
  canViewRequiredMilestone({
    mode: target.club.progress.mode,
    currentMilestonePosition: target.club.progress.currentMilestonePosition,
    requiredMilestonePosition: target.requiredMilestone.position
  }) &&
  (!target.postRequiredMilestone ||
    canViewRequiredMilestone({
      mode: target.club.progress.mode,
      currentMilestonePosition: target.club.progress.currentMilestonePosition,
      requiredMilestonePosition: target.postRequiredMilestone.position
    }));
