import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type {
  CreateReportRequest,
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

export type ModerationClubAccessRecord = {
  id: string;
  visibility: ClubVisibility;
  currentUserRole: ClubMembershipRole | null;
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

export type ModerationReportsCursor = {
  createdAt: Date;
  id: string;
};

export type ListModerationReportsResult = {
  reports: ModerationReportRecord[];
  nextCursor: ModerationReportsCursor | null;
  hasMore: boolean;
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
  findClubAccessBySlug: (
    slug: string,
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

const moderationReportSelect = {
  ...reportSelect,
  reporter: {
    select: {
      id: true,
      displayName: true,
      username: true
    }
  },
  post: {
    select: {
      id: true,
      status: true,
      deletedAt: true,
      title: true,
      body: true,
      author: {
        select: {
          id: true,
          displayName: true,
          username: true
        }
      },
      requiredMilestone: {
        select: {
          id: true,
          position: true,
          safeTitle: true
        }
      }
    }
  },
  comment: {
    select: {
      id: true,
      status: true,
      deletedAt: true,
      body: true,
      author: {
        select: {
          id: true,
          displayName: true,
          username: true
        }
      },
      requiredMilestone: {
        select: {
          id: true,
          position: true,
          safeTitle: true
        }
      }
    }
  }
} satisfies Prisma.ReportSelect;

type SelectedModerationReport = Prisma.ReportGetPayload<{
  select: typeof moderationReportSelect;
}>;

const toModerationReportRecord = (
  report: SelectedModerationReport
): ModerationReportRecord => ({
  ...toReportRecord(report),
  reporter: report.reporter,
  target:
    report.targetType === "POST" && report.post
      ? {
          targetType: "POST",
          ...report.post
        }
      : report.targetType === "COMMENT" && report.comment
        ? {
            targetType: "COMMENT",
            ...report.comment
          }
        : null
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
  },

  findClubAccessBySlug: async (slug, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        slug
      },
      select: {
        id: true,
        visibility: true,
        memberships: {
          where: {
            userId
          },
          select: {
            role: true
          },
          take: 1
        }
      }
    });

    if (!club) {
      return null;
    }

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: club.memberships[0]?.role ?? null
    };
  },

  listModerationReports: async (clubId, { cursor, limit, status }) => {
    const cursorWhere: Prisma.ReportWhereInput = cursor
      ? {
          OR: [
            {
              createdAt: {
                lt: cursor.createdAt
              }
            },
            {
              createdAt: cursor.createdAt,
              id: {
                gt: cursor.id
              }
            }
          ]
        }
      : {};
    const reports = await prisma.report.findMany({
      where: {
        clubId,
        status,
        ...cursorWhere
      },
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "asc"
        }
      ],
      take: limit + 1,
      select: moderationReportSelect
    });
    const pageReports = reports.slice(0, limit);
    const lastReport = pageReports[pageReports.length - 1];

    return {
      reports: pageReports.map(toModerationReportRecord),
      nextCursor:
        reports.length > limit && lastReport
          ? {
              createdAt: lastReport.createdAt,
              id: lastReport.id
            }
          : null,
      hasMore: reports.length > limit
    };
  },

  findModerationReportById: async (clubId, reportId) => {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        clubId
      },
      select: moderationReportSelect
    });

    return report ? toModerationReportRecord(report) : null;
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
