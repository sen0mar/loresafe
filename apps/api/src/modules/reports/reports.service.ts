import { HttpError } from "../../core/errors/http-error.js";
import { toReportDto, type CreateReportResponse } from "./reports.dto.js";
import { canReportTarget } from "./reports.policy.js";
import {
  reportsRepository,
  type ReportsRepository,
  type ReportTargetRecord
} from "./reports.repository.js";
import type { CreateReportRequest } from "./reports.schema.js";

export type ReportsService = {
  createReport: (
    userId: string,
    input: CreateReportRequest
  ) => Promise<CreateReportResponse>;
};

export const createReportsService = (
  repository: ReportsRepository = reportsRepository
): ReportsService => ({
  createReport: async (userId, input) => {
    const target = await findTarget(repository, userId, input);

    if (!target || !canReportTarget(target)) {
      throw new HttpError(404, "NOT_FOUND", "Target not found");
    }

    const report = await repository.createReport(userId, target, input);

    return {
      report: toReportDto(report)
    };
  }
});

export const reportsService = createReportsService();

const findTarget = (
  repository: ReportsRepository,
  userId: string,
  input: CreateReportRequest
): Promise<ReportTargetRecord | null> =>
  input.targetType === "POST"
    ? repository.findPostTarget(input.targetId, userId)
    : repository.findCommentTarget(input.targetId, userId);
