import { reportsRepository } from "./reports.repository.js";
import type { ReportsRepository } from "./reports.repository.types.js";

export type ReportsCommandRepository = Pick<
  ReportsRepository,
  | "banReportedContentAuthor"
  | "createReport"
  | "deleteReportedContent"
  | "hideReportedContent"
  | "resolveModerationReport"
  | "updateReportRequiredMilestone"
  | "warnReportedContentAuthor"
>;

export const reportsCommandRepository: ReportsCommandRepository = {
  banReportedContentAuthor: reportsRepository.banReportedContentAuthor,
  createReport: reportsRepository.createReport,
  deleteReportedContent: reportsRepository.deleteReportedContent,
  hideReportedContent: reportsRepository.hideReportedContent,
  resolveModerationReport: reportsRepository.resolveModerationReport,
  updateReportRequiredMilestone:
    reportsRepository.updateReportRequiredMilestone,
  warnReportedContentAuthor: reportsRepository.warnReportedContentAuthor
};
