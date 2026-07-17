import type { ClubPostRequiredMilestone } from "./clubs-discussion.types.js";

export type ReportTargetType = "POST" | "COMMENT";

export type ReportReason =
  "SPOILER" | "HARASSMENT" | "HATE" | "SPAM" | "OFF_TOPIC" | "OTHER";
export type CreateReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

export type Report = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  updatedAt: string;
};

export type ModerationReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export type ModerationReportUser = {
  id: string;
  displayName: string;
  username: string | null;
};

export type ModerationReportTargetMetadata = {
  id: string;
  targetType: ReportTargetType;
  visibility: "HIDDEN";
  status: "VISIBLE" | "HIDDEN" | "DELETED" | "UNAVAILABLE";
  author: ModerationReportUser | null;
  requiredMilestone: ClubPostRequiredMilestone | null;
  contentHidden: true;
};

export type RevealedModerationReportTarget =
  | (Omit<
      ModerationReportTargetMetadata,
      "visibility" | "contentHidden" | "targetType"
    > & {
      targetType: "POST";
      visibility: "REVEALED";
      title: string;
      body: string;
    })
  | (Omit<
      ModerationReportTargetMetadata,
      "visibility" | "contentHidden" | "targetType"
    > & {
      targetType: "COMMENT";
      visibility: "REVEALED";
      body: string;
    });

export type ModerationReport = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: ModerationReportStatus;
  reporter: ModerationReportUser;
  detailsHidden: boolean;
  target: ModerationReportTargetMetadata;
  createdAt: string;
  updatedAt: string;
};

export type RevealedModerationReport = Omit<
  ModerationReport,
  "detailsHidden" | "target"
> & {
  details: string | null;
  target: RevealedModerationReportTarget;
};

export type CreateReportResponse = {
  report: Report;
};

export type ModerationReportsResponse = {
  reports: ModerationReport[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type RevealModerationReportResponse = {
  report: RevealedModerationReport;
};

export type ModerationReportActionResponse = {
  report: ModerationReport;
  deletedPostCount?: number;
};

export type ModerationReportNoteInput = {
  moderatorNote?: string;
};

export type UpdateReportRequiredMilestoneInput = ModerationReportNoteInput & {
  requiredMilestoneId: string;
};

export type BanReportedContentAuthorInput = ModerationReportNoteInput & {
  expiresAt?: string;
  deleteAuthoredPosts?: boolean;
};

export type ResolveModerationReportInput = ModerationReportNoteInput & {
  status: "RESOLVED" | "DISMISSED";
};
