import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { CreateReportRequest, ReportReason } from "./reports.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";
type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export type ReportTargetRecord = {
  targetType: "POST" | "COMMENT";
  targetId: string;
  clubId: string;
  requiredMilestone: {
    position: number;
  };
  postRequiredMilestone?: {
    position: number;
  };
  club: {
    visibility: ClubVisibility;
    currentUserRole: ClubMembershipRole | null;
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
};

const reportSelect = {
  id: true,
  targetType: true,
  reason: true,
  details: true,
  status: true,
  postId: true,
  commentId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ReportSelect;

type SelectedReport = Prisma.ReportGetPayload<{
  select: typeof reportSelect;
}>;

const toReportRecord = (report: SelectedReport): ReportRecord => ({
  id: report.id,
  targetType: report.targetType,
  reason: report.reason,
  details: report.details,
  status: report.status,
  postId: report.postId,
  commentId: report.commentId,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt
});

const toProgress = (
  progress:
    | Array<{
        mode: ProgressMode;
        currentMilestone: {
          position: number;
        } | null;
      }>
    | undefined
) => ({
  mode: (progress?.[0]?.mode ?? "STRICT") as ProgressMode,
  currentMilestonePosition: progress?.[0]?.currentMilestone?.position ?? null
});

export const reportsRepository: ReportsRepository = {
  findPostTarget: async (postId, userId) => {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "VISIBLE",
        deletedAt: null
      },
      select: {
        id: true,
        clubId: true,
        requiredMilestone: {
          select: {
            position: true
          }
        },
        club: {
          select: clubAccessSelect(userId)
        }
      }
    });

    if (!post) {
      return null;
    }

    return {
      targetType: "POST",
      targetId: post.id,
      clubId: post.clubId,
      requiredMilestone: post.requiredMilestone,
      club: {
        visibility: post.club.visibility,
        currentUserRole: post.club.memberships[0]?.role ?? null,
        progress: toProgress(post.club.progress)
      }
    };
  },

  findCommentTarget: async (commentId, userId) => {
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        status: "VISIBLE",
        deletedAt: null,
        post: {
          status: "VISIBLE",
          deletedAt: null
        }
      },
      select: {
        id: true,
        requiredMilestone: {
          select: {
            position: true
          }
        },
        post: {
          select: {
            clubId: true,
            requiredMilestone: {
              select: {
                position: true
              }
            },
            club: {
              select: clubAccessSelect(userId)
            }
          }
        }
      }
    });

    if (!comment) {
      return null;
    }

    return {
      targetType: "COMMENT",
      targetId: comment.id,
      clubId: comment.post.clubId,
      requiredMilestone: comment.requiredMilestone,
      postRequiredMilestone: comment.post.requiredMilestone,
      club: {
        visibility: comment.post.club.visibility,
        currentUserRole: comment.post.club.memberships[0]?.role ?? null,
        progress: toProgress(comment.post.club.progress)
      }
    };
  },

  findOpenReportForTarget: async (reporterId, input) => {
    const report = await prisma.report.findFirst({
      where: {
        reporterId,
        status: "OPEN",
        ...(input.targetType === "POST"
          ? {
              postId: input.targetId
            }
          : {
              commentId: input.targetId
            })
      },
      select: reportSelect
    });

    return report ? toReportRecord(report) : null;
  },

  createReport: async (reporterId, target, input) => {
    const existingReport = await reportsRepository.findOpenReportForTarget(
      reporterId,
      input
    );

    if (existingReport) {
      return existingReport;
    }

    try {
      const report = await prisma.report.create({
        data: {
          targetType: input.targetType,
          reason: input.reason,
          details: input.details ?? null,
          reporterId,
          clubId: target.clubId,
          ...(input.targetType === "POST"
            ? {
                postId: target.targetId
              }
            : {
                commentId: target.targetId
              })
        },
        select: reportSelect
      });

      return toReportRecord(report);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const report = await reportsRepository.findOpenReportForTarget(
          reporterId,
          input
        );

        if (report) {
          return report;
        }
      }

      throw error;
    }
  }
};

const clubAccessSelect = (userId: string) =>
  ({
    visibility: true,
    memberships: {
      where: {
        userId
      },
      select: {
        role: true
      },
      take: 1
    },
    progress: {
      where: {
        userId
      },
      select: {
        mode: true,
        currentMilestone: {
          select: {
            position: true
          }
        }
      },
      take: 1
    }
  }) satisfies Prisma.ClubSelect;

const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
