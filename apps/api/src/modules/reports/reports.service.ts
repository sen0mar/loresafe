import { HttpError } from "../../core/errors/http-error.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import {
  eventsService,
  type EventsService
} from "../events/events.service.js";
import {
  toModerationReportDto,
  toReportDto,
  toRevealedModerationReportDto,
  type CreateReportResponse,
  type ListModerationReportsResponse,
  type ModerationReportActionResponse,
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
  ListModerationReportsQuery,
  ModerationReportBanRequest,
  ModerationReportNoteRequest,
  ModerationReportRequiredMilestoneRequest,
  ModerationReportResolveRequest
} from "./reports.schema.js";

export type ReportsService = {
  createReport: (
    userId: string,
    input: CreateReportRequest
  ) => Promise<CreateReportResponse>;
  listModerationReportsForClub: (
    linkName: string,
    userId: string,
    query: ListModerationReportsQuery
  ) => Promise<ListModerationReportsResponse>;
  revealModerationReportForClub: (
    linkName: string,
    reportId: string,
    userId: string
  ) => Promise<RevealModerationReportResponse>;
  updateReportRequiredMilestoneForClub: (
    linkName: string,
    reportId: string,
    userId: string,
    input: ModerationReportRequiredMilestoneRequest
  ) => Promise<ModerationReportActionResponse>;
  hideReportedContentForClub: (
    linkName: string,
    reportId: string,
    userId: string,
    input: ModerationReportNoteRequest
  ) => Promise<ModerationReportActionResponse>;
  deleteReportedContentForClub: (
    linkName: string,
    reportId: string,
    userId: string,
    input: ModerationReportNoteRequest
  ) => Promise<ModerationReportActionResponse>;
  warnReportedContentAuthorForClub: (
    linkName: string,
    reportId: string,
    userId: string,
    input: ModerationReportNoteRequest
  ) => Promise<ModerationReportActionResponse>;
  banReportedContentAuthorForClub: (
    linkName: string,
    reportId: string,
    userId: string,
    input: ModerationReportBanRequest
  ) => Promise<ModerationReportActionResponse>;
  resolveModerationReportForClub: (
    linkName: string,
    reportId: string,
    userId: string,
    input: ModerationReportResolveRequest
  ) => Promise<ModerationReportActionResponse>;
};

export const createReportsService = (
  repository: ReportsRepository = reportsRepository,
  eventPublisher: EventsService = eventsService
): ReportsService => ({
  createReport: async (userId, input) => {
    const target = await findTarget(repository, userId, input);

    if (!target) {
      throw new HttpError(404, "NOT_FOUND", "Target not found");
    }

    if (target.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canReportTarget(target)) {
      throw new HttpError(404, "NOT_FOUND", "Target not found");
    }

    const report = await repository.createReport(userId, target, input);

    return {
      report: toReportDto(report)
    };
  },

  listModerationReportsForClub: async (linkName, userId, query) => {
    const club = await repository.findClubAccessByLinkName(linkName, userId);
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

  revealModerationReportForClub: async (linkName, reportId, userId) => {
    const club = await repository.findClubAccessByLinkName(linkName, userId);
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
  },

  updateReportRequiredMilestoneForClub: async (linkName, reportId, userId, input) =>
    runModerationAction(linkName, reportId, userId, repository, eventPublisher, (club) =>
      repository.updateReportRequiredMilestone(club.id, reportId, userId, input)
    ),

  hideReportedContentForClub: async (linkName, reportId, userId, input) =>
    runModerationAction(linkName, reportId, userId, repository, eventPublisher, (club) =>
      repository.hideReportedContent(club.id, reportId, userId, input)
    ),

  deleteReportedContentForClub: async (linkName, reportId, userId, input) =>
    runModerationAction(linkName, reportId, userId, repository, eventPublisher, (club) =>
      repository.deleteReportedContent(club.id, reportId, userId, input)
    ),

  warnReportedContentAuthorForClub: async (linkName, reportId, userId, input) =>
    runModerationAction(linkName, reportId, userId, repository, eventPublisher, (club) =>
      repository.warnReportedContentAuthor(club.id, reportId, userId, input)
    ),

  banReportedContentAuthorForClub: async (linkName, reportId, userId, input) =>
    runModerationAction(linkName, reportId, userId, repository, eventPublisher, (club) =>
      repository.banReportedContentAuthor(club.id, reportId, userId, input)
    ),

  resolveModerationReportForClub: async (linkName, reportId, userId, input) =>
    runModerationAction(linkName, reportId, userId, repository, eventPublisher, (club) =>
      repository.resolveModerationReport(club.id, reportId, userId, input)
    )
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
  if (!club) {
    throw new HttpError(404, "NOT_FOUND", "Club not found");
  }

  if (club.isCurrentUserBanned) {
    throw bannedFromClubError();
  }

  if (club.visibility !== "PUBLIC" && !club.currentUserRole) {
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

const runModerationAction = async (
  linkName: string,
  reportId: string,
  userId: string,
  repository: ReportsRepository,
  eventPublisher: EventsService,
  action: (
    club: ModerationClubAccessRecord
  ) => ReturnType<ReportsRepository["hideReportedContent"]>
): Promise<ModerationReportActionResponse> => {
  const club = await repository.findClubAccessByLinkName(linkName, userId);
  const moderationClub = getAccessibleModerationClub(club);
  const result = await action(moderationClub);

  if (result.status === "SUCCESS") {
    if (result.notification?.wasCreated) {
      eventPublisher.publishNotificationCreated(result.notification.userId, {
        notificationId: result.notification.id,
        club: result.notification.club,
        postId: result.notification.postId,
        commentId: result.notification.commentId,
        occurredAt: result.notification.createdAt.toISOString()
      });
    }

    return {
      report: toModerationReportDto(result.report),
      ...(result.deletedPostCount !== undefined
        ? { deletedPostCount: result.deletedPostCount }
        : {})
    };
  }

  switch (result.status) {
    case "REPORT_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Report not found");
    case "TARGET_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Reported content not found");
    case "MILESTONE_NOT_FOUND":
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Choose a milestone from this club."
      );
    case "TARGET_PROTECTED":
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You cannot ban this club member."
      );
    case "LAST_OWNER":
      throw new HttpError(
        409,
        "CONFLICT",
        "This club must keep at least one owner."
      );
    case "REPORT_CLOSED":
      throw new HttpError(
        409,
        "CONFLICT",
        "This report has already been resolved."
      );
  }
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
