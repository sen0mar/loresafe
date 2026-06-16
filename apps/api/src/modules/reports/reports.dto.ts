import type {
  ModerationReportRecord,
  ReportRecord
} from "./reports.repository.js";

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

type ReportUserDto = {
  id: string;
  displayName: string;
  username: string | null;
};

type ModerationReportTargetMetadataDto = {
  id: string;
  targetType: "POST" | "COMMENT";
  visibility: "HIDDEN";
  status: "VISIBLE" | "HIDDEN" | "DELETED" | "UNAVAILABLE";
  author: ReportUserDto | null;
  requiredMilestone: {
    id: string;
    position: number;
    label: string;
  } | null;
  contentHidden: true;
};

type RevealedModerationReportTargetDto =
  | (Omit<ModerationReportTargetMetadataDto, "visibility" | "contentHidden"> & {
      targetType: "POST";
      visibility: "REVEALED";
      title: string;
      body: string;
    })
  | (Omit<ModerationReportTargetMetadataDto, "visibility" | "contentHidden"> & {
      targetType: "COMMENT";
      visibility: "REVEALED";
      body: string;
    });

export type ModerationReportDto = {
  id: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: ReportDto["reason"];
  status: ReportStatusDto;
  reporter: ReportUserDto;
  detailsHidden: boolean;
  target: ModerationReportTargetMetadataDto;
  createdAt: string;
  updatedAt: string;
};

export type RevealedModerationReportDto = Omit<
  ModerationReportDto,
  "detailsHidden" | "target"
> & {
  details: string | null;
  target: RevealedModerationReportTargetDto;
};

export type ListModerationReportsResponse = {
  reports: ModerationReportDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type RevealModerationReportResponse = {
  report: RevealedModerationReportDto;
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

export const toModerationReportDto = (
  report: ModerationReportRecord
): ModerationReportDto => ({
  id: report.id,
  targetType: report.targetType,
  targetId: toTargetId(report),
  reason: report.reason,
  status: report.status,
  reporter: report.reporter,
  detailsHidden: report.details !== null,
  target: toModerationTargetMetadataDto(report),
  createdAt: report.createdAt.toISOString(),
  updatedAt: report.updatedAt.toISOString()
});

export const toRevealedModerationReportDto = (
  report: ModerationReportRecord
): RevealedModerationReportDto => ({
  id: report.id,
  targetType: report.targetType,
  targetId: toTargetId(report),
  reason: report.reason,
  status: report.status,
  reporter: report.reporter,
  details: report.details,
  target: toRevealedModerationTargetDto(report),
  createdAt: report.createdAt.toISOString(),
  updatedAt: report.updatedAt.toISOString()
});

const toTargetId = (report: ModerationReportRecord | ReportRecord) =>
  report.targetType === "POST"
    ? (report.postId as string)
    : (report.commentId as string);

const toModerationTargetMetadataDto = (
  report: ModerationReportRecord
): ModerationReportTargetMetadataDto => {
  const targetId = toTargetId(report);

  if (!report.target) {
    return {
      id: targetId,
      targetType: report.targetType,
      visibility: "HIDDEN",
      status: "UNAVAILABLE",
      author: null,
      requiredMilestone: null,
      contentHidden: true
    };
  }

  return {
    id: report.target.id,
    targetType: report.target.targetType,
    visibility: "HIDDEN",
    status: report.target.deletedAt ? "DELETED" : report.target.status,
    author: report.target.author,
    requiredMilestone: {
      id: report.target.requiredMilestone.id,
      position: report.target.requiredMilestone.position,
      label: report.target.requiredMilestone.safeTitle
    },
    contentHidden: true
  };
};

const toRevealedModerationTargetDto = (
  report: ModerationReportRecord
): RevealedModerationReportDto["target"] => {
  const metadata = toModerationTargetMetadataDto(report);
  const revealedMetadata = {
    id: metadata.id,
    targetType: metadata.targetType,
    status: metadata.status,
    author: metadata.author,
    requiredMilestone: metadata.requiredMilestone
  };

  if (!report.target) {
    return {
      ...revealedMetadata,
      targetType: report.targetType,
      visibility: "REVEALED",
      body: "Reported content is no longer available.",
      ...(report.targetType === "POST"
        ? {
            title: "Unavailable content"
          }
        : {})
    } as RevealedModerationReportDto["target"];
  }

  if (report.target.targetType === "POST") {
    return {
      ...revealedMetadata,
      targetType: "POST",
      visibility: "REVEALED",
      title: report.target.title,
      body: report.target.body
    };
  }

  return {
    ...revealedMetadata,
    targetType: "COMMENT",
    visibility: "REVEALED",
    body: report.target.body
  };
};
