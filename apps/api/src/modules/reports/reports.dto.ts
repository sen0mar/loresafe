import type { ReportRecord } from "./reports.repository.js";

export type ReportStatusDto = "OPEN" | "RESOLVED" | "DISMISSED";

export type ReportDto = {
  id: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: "SPOILER" | "HARASSMENT" | "HATE" | "SPAM" | "OFF_TOPIC" | "OTHER";
  details: string | null;
  status: ReportStatusDto;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportResponse = {
  report: ReportDto;
};

export const toReportDto = (report: ReportRecord): ReportDto => ({
  id: report.id,
  targetType: report.targetType,
  targetId:
    report.targetType === "POST"
      ? (report.postId as string)
      : (report.commentId as string),
  reason: report.reason,
  details: report.details,
  status: report.status,
  createdAt: report.createdAt.toISOString(),
  updatedAt: report.updatedAt.toISOString()
});
