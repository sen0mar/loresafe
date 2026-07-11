import type { CreateNotificationResult } from "../notifications/notifications.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type {
  CreateReportRequest,
  ModerationReportBanRequest,
  ModerationReportNoteRequest,
  ModerationReportRequiredMilestoneRequest,
  ModerationReportResolveRequest,
  ModerationReportStatus,
  ReportReason
} from "./reports.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";
type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export type ReportTargetRecord = {
  targetType: "POST" | "COMMENT";
  targetId: string;
  clubId: string;
  requiredMilestone: { position: number };
  postRequiredMilestone?: { position: number };
  club: {
    visibility: ClubVisibility;
    currentUserRole: ClubMembershipRole | null;
    isCurrentUserBanned: boolean;
    progress: {
      mode: ProgressMode;
      currentMilestonePosition: number | null;
    };
  };
};

export type ReportRecord = {
  id: string;
  targetType: "POST" | "COMMENT";
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  postId: string | null;
  commentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ModerationClubAccessRecord = {
  id: string;
  visibility: ClubVisibility;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
};

type ReportTargetAuthorRecord = {
  id: string;
  displayName: string;
  username: string | null;
};

type ReportTargetMilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
};

export type ModerationReportRecord = ReportRecord & {
  reporter: ReportTargetAuthorRecord;
  target:
    | {
        targetType: "POST";
        id: string;
        status: "VISIBLE" | "HIDDEN";
        deletedAt: Date | null;
        title: string;
        body: string;
        author: ReportTargetAuthorRecord;
        requiredMilestone: ReportTargetMilestoneRecord;
      }
    | {
        targetType: "COMMENT";
        id: string;
        status: "VISIBLE" | "HIDDEN";
        deletedAt: Date | null;
        body: string;
        author: ReportTargetAuthorRecord;
        requiredMilestone: ReportTargetMilestoneRecord;
      }
    | null;
};

export type ModerationReportsCursor = { createdAt: Date; id: string };

export type ListModerationReportsResult = {
  reports: ModerationReportRecord[];
  nextCursor: ModerationReportsCursor | null;
  hasMore: boolean;
};

export type ModerationActionRepositoryResult =
  | {
      status: "SUCCESS";
      report: ModerationReportRecord;
      deletedPostCount?: number;
      notification?: CreateNotificationResult;
    }
  | {
      status:
        | "REPORT_NOT_FOUND"
        | "REPORT_CLOSED"
        | "TARGET_NOT_FOUND"
        | "MILESTONE_NOT_FOUND"
        | "ACCESS_DENIED"
        | "TARGET_PROTECTED"
        | "LAST_OWNER";
    };

export type ReportsRepository = {
  findPostTarget: (
    postId: string,
    userId: string
  ) => Promise<ReportTargetRecord | null>;
  findCommentTarget: (
    commentId: string,
    userId: string
  ) => Promise<ReportTargetRecord | null>;
  findOpenReportForTarget: (
    reporterId: string,
    input: Pick<CreateReportRequest, "targetId" | "targetType">
  ) => Promise<ReportRecord | null>;
  createReport: (
    reporterId: string,
    target: ReportTargetRecord,
    input: CreateReportRequest
  ) => Promise<ReportRecord>;
  findClubAccessByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<ModerationClubAccessRecord | null>;
  listModerationReports: (
    clubId: string,
    input: {
      status: ModerationReportStatus;
      cursor: ModerationReportsCursor | null;
      limit: number;
    }
  ) => Promise<ListModerationReportsResult>;
  findModerationReportById: (
    clubId: string,
    reportId: string
  ) => Promise<ModerationReportRecord | null>;
  updateReportRequiredMilestone: (
    clubId: string,
    reportId: string,
    actorId: string,
    input: ModerationReportRequiredMilestoneRequest
  ) => Promise<ModerationActionRepositoryResult>;
  hideReportedContent: (
    clubId: string,
    reportId: string,
    actorId: string,
    input: ModerationReportNoteRequest
  ) => Promise<ModerationActionRepositoryResult>;
  deleteReportedContent: (
    clubId: string,
    reportId: string,
    actorId: string,
    input: ModerationReportNoteRequest
  ) => Promise<ModerationActionRepositoryResult>;
  warnReportedContentAuthor: (
    clubId: string,
    reportId: string,
    actorId: string,
    input: ModerationReportNoteRequest
  ) => Promise<ModerationActionRepositoryResult>;
  banReportedContentAuthor: (
    clubId: string,
    reportId: string,
    actorId: string,
    input: ModerationReportBanRequest
  ) => Promise<ModerationActionRepositoryResult>;
  resolveModerationReport: (
    clubId: string,
    reportId: string,
    actorId: string,
    input: ModerationReportResolveRequest
  ) => Promise<ModerationActionRepositoryResult>;
};
