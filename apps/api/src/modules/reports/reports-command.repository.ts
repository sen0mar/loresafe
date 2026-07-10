import { reportsRepository, type ReportsRepository } from "./reports.repository.js";

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
  updateReportRequiredMilestone: reportsRepository.updateReportRequiredMilestone,
  warnReportedContentAuthor: reportsRepository.warnReportedContentAuthor
};
