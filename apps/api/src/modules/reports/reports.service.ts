import { HttpError } from "../../core/errors/http-error.js";
import {
  toModerationReportDto,
  toReportDto,
  toRevealedModerationReportDto,
  type CreateReportResponse,
  type ListModerationReportsResponse,
  type RevealModerationReportResponse
} from "./reports.dto.js";
import { canModerateReports, canReportTarget } from "./reports.policy.js";
import {
  reportsRepository,
  type ModerationClubAccessRecord,
  type ModerationReportsCursor,
  type ReportsRepository,
  type ReportTargetRecord
} from "./reports.repository.js";
import type {
  CreateReportRequest,
  ListModerationReportsQuery
} from "./reports.schema.js";

export type ReportsService = {
  createReport: (
    userId: string,
    input: CreateReportRequest
  ) => Promise<CreateReportResponse>;
  listModerationReportsForClub: (
    slug: string,
    userId: string,
    query: ListModerationReportsQuery
  ) => Promise<ListModerationReportsResponse>;
  revealModerationReportForClub: (
    slug: string,
    reportId: string,
    userId: string
  ) => Promise<RevealModerationReportResponse>;
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
  },

  listModerationReportsForClub: async (slug, userId, query) => {
    const club = await repository.findClubAccessBySlug(slug, userId);
    const moderationClub = getAccessibleModerationClub(club);

    const result = await repository.listModerationReports(moderationClub.id, {
      status: query.status,
      cursor: decodeModerationReportsCursor(query.cursor),
      limit: query.limit
    });

    return {
      reports: result.reports.map(toModerationReportDto),
      pagination: {
        limit: query.limit,
        nextCursor: result.nextCursor
          ? encodeModerationReportsCursor(result.nextCursor)
          : null,
        hasMore: result.hasMore
      }
    };
  },

  revealModerationReportForClub: async (slug, reportId, userId) => {
    const club = await repository.findClubAccessBySlug(slug, userId);
    const moderationClub = getAccessibleModerationClub(club);

    const report = await repository.findModerationReportById(
      moderationClub.id,
      reportId
    );

    if (!report) {
      throw new HttpError(404, "NOT_FOUND", "Report not found");
    }

    return {
      report: toRevealedModerationReportDto(report)
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

const getAccessibleModerationClub = (
  club: ModerationClubAccessRecord | null
): ModerationClubAccessRecord => {
  if (!club || (club.visibility !== "PUBLIC" && !club.currentUserRole)) {
    throw new HttpError(404, "NOT_FOUND", "Club not found");
  }

  if (!canModerateReports(club.currentUserRole)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Only club owners and moderators can review reports."
    );
  }

  return club;
};

const encodeModerationReportsCursor = ({ createdAt, id }: ModerationReportsCursor) =>
  Buffer.from(
    JSON.stringify({
      createdAt: createdAt.toISOString(),
      id
    })
  ).toString("base64url");

const decodeModerationReportsCursor = (
  cursor: string | undefined
): ModerationReportsCursor | null => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Malformed cursor");
    }

    const createdAt = new Date(parsed.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Malformed cursor");
    }

    return {
      createdAt,
      id: parsed.id
    };
  } catch {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Check the moderation reports request and try again."
    );
  }
};
