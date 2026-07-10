import { reportsRepository, type ReportsRepository } from "./reports.repository.js";

export type ReportsQueryRepository = Pick<
  ReportsRepository,
  | "findClubAccessByLinkName"
  | "findCommentTarget"
  | "findModerationReportById"
  | "findOpenReportForTarget"
  | "findPostTarget"
  | "listModerationReports"
>;

export const reportsQueryRepository: ReportsQueryRepository = {
  findClubAccessByLinkName: reportsRepository.findClubAccessByLinkName,
  findCommentTarget: reportsRepository.findCommentTarget,
  findModerationReportById: reportsRepository.findModerationReportById,
  findOpenReportForTarget: reportsRepository.findOpenReportForTarget,
  findPostTarget: reportsRepository.findPostTarget,
  listModerationReports: reportsRepository.listModerationReports
};
