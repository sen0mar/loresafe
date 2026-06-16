import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  createNotificationInTransaction,
  type CreateNotificationResult
} from "../notifications/notifications.repository.js";
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
type AuditLogAction =
  | "POST_REQUIRED_MILESTONE_CHANGED"
  | "POST_HIDDEN"
  | "POST_DELETED"
  | "COMMENT_REQUIRED_MILESTONE_CHANGED"
  | "COMMENT_HIDDEN"
  | "COMMENT_DELETED"
  | "USER_WARNED"
  | "USER_BANNED"
  | "REPORT_RESOLVED"
  | "REPORT_DISMISSED";

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

export type ModerationActionRepositoryResult =
  | {
      status: "SUCCESS";
      report: ModerationReportRecord;
      notification?: CreateNotificationResult;
    }
  | {
      status:
        | "REPORT_NOT_FOUND"
        | "REPORT_CLOSED"
        | "TARGET_NOT_FOUND"
        | "MILESTONE_NOT_FOUND";
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
  },

  updateReportRequiredMilestone: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(clubId, reportId, actorId, async ({
      report,
      target,
      transaction
    }) => {
      const milestone = await transaction.milestone.findFirst({
        where: {
          id: input.requiredMilestoneId,
          clubId
        },
        select: {
          id: true,
          position: true
        }
      });

      if (!milestone) {
        return {
          status: "MILESTONE_NOT_FOUND"
        };
      }

      if (target.targetType === "POST") {
        await transaction.post.update({
          where: {
            id: target.id
          },
          data: {
            requiredMilestoneId: milestone.id
          },
          select: {
            id: true
          }
        });
      } else {
        await transaction.comment.update({
          where: {
            id: target.id
          },
          data: {
            requiredMilestoneId: milestone.id
          },
          select: {
            id: true
          }
        });
      }

      await resolveReportInTransaction(transaction, report.id);
      await createAuditLogInTransaction(transaction, {
        action:
          target.targetType === "POST"
            ? "POST_REQUIRED_MILESTONE_CHANGED"
            : "COMMENT_REQUIRED_MILESTONE_CHANGED",
        actorId,
        clubId,
        reportId: report.id,
        postId: target.targetType === "POST" ? target.id : report.postId,
        commentId: target.targetType === "COMMENT" ? target.id : null,
        targetUserId: target.authorId,
        moderatorNote: input.moderatorNote,
        metadata: {
          previousRequiredMilestoneId: target.requiredMilestoneId,
          previousRequiredMilestonePosition: target.requiredMilestone.position,
          requiredMilestoneId: milestone.id,
          requiredMilestonePosition: milestone.position
        }
      });

      return {
        status: "SUCCESS"
      };
    }),

  hideReportedContent: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(clubId, reportId, actorId, async ({
      report,
      target,
      transaction
    }) => {
      if (target.targetType === "POST") {
        await transaction.post.update({
          where: {
            id: target.id
          },
          data: {
            status: "HIDDEN"
          },
          select: {
            id: true
          }
        });
      } else {
        await transaction.comment.update({
          where: {
            id: target.id
          },
          data: {
            status: "HIDDEN"
          },
          select: {
            id: true
          }
        });
      }

      await resolveReportInTransaction(transaction, report.id);
      await createAuditLogInTransaction(transaction, {
        action: target.targetType === "POST" ? "POST_HIDDEN" : "COMMENT_HIDDEN",
        actorId,
        clubId,
        reportId: report.id,
        postId: target.targetType === "POST" ? target.id : report.postId,
        commentId: target.targetType === "COMMENT" ? target.id : null,
        targetUserId: target.authorId,
        moderatorNote: input.moderatorNote,
        metadata: {
          previousStatus: target.status,
          status: "HIDDEN"
        }
      });

      return {
        status: "SUCCESS"
      };
    }),

  deleteReportedContent: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(clubId, reportId, actorId, async ({
      report,
      target,
      transaction
    }) => {
      const deletedAt = new Date();

      if (target.targetType === "POST") {
        await transaction.post.update({
          where: {
            id: target.id
          },
          data: {
            deletedAt
          },
          select: {
            id: true
          }
        });
      } else {
        await transaction.comment.update({
          where: {
            id: target.id
          },
          data: {
            deletedAt
          },
          select: {
            id: true
          }
        });
      }

      await resolveReportInTransaction(transaction, report.id);
      await createAuditLogInTransaction(transaction, {
        action:
          target.targetType === "POST" ? "POST_DELETED" : "COMMENT_DELETED",
        actorId,
        clubId,
        reportId: report.id,
        postId: target.targetType === "POST" ? target.id : report.postId,
        commentId: target.targetType === "COMMENT" ? target.id : null,
        targetUserId: target.authorId,
        moderatorNote: input.moderatorNote,
        metadata: {
          previousDeletedAt: target.deletedAt?.toISOString() ?? null,
          deletedAt: deletedAt.toISOString()
        }
      });

      return {
        status: "SUCCESS"
      };
    }),

  warnReportedContentAuthor: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(clubId, reportId, actorId, async ({
      report,
      target,
      transaction
    }) => {
      await resolveReportInTransaction(transaction, report.id);
      await createAuditLogInTransaction(transaction, {
        action: "USER_WARNED",
        actorId,
        clubId,
        reportId: report.id,
        postId: target.targetType === "POST" ? target.id : report.postId,
        commentId: target.targetType === "COMMENT" ? target.id : null,
        targetUserId: target.authorId,
        moderatorNote: input.moderatorNote,
        metadata: {
          targetType: target.targetType
        }
      });

      const notification = await createNotificationInTransaction(transaction, {
        userId: target.authorId,
        type: "MODERATION_WARNING",
        eventKey: `moderation-warning:${report.id}:${target.authorId}`,
        safeText: `A moderator issued a warning in ${report.club.title}.`,
        clubId,
        postId: target.targetType === "POST" ? target.id : report.postId,
        commentId: target.targetType === "COMMENT" ? target.id : null,
        requiredMilestoneId: target.requiredMilestoneId
      });

      return {
        status: "SUCCESS",
        notification
      };
    }),

  banReportedContentAuthor: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(clubId, reportId, actorId, async ({
      report,
      target,
      transaction
    }) => {
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      const activeBan = await transaction.clubBan.findFirst({
        where: {
          clubId,
          userId: target.authorId,
          revokedAt: null,
          OR: [
            {
              expiresAt: null
            },
            {
              expiresAt: {
                gt: new Date()
              }
            }
          ]
        },
        select: {
          id: true
        }
      });
      const ban = activeBan
        ? await transaction.clubBan.update({
            where: {
              id: activeBan.id
            },
            data: {
              expiresAt,
              reason: "Moderation action"
            },
            select: {
              id: true
            }
          })
        : await transaction.clubBan.create({
            data: {
              clubId,
              userId: target.authorId,
              expiresAt,
              reason: "Moderation action"
            },
            select: {
              id: true
            }
          });

      await resolveReportInTransaction(transaction, report.id);
      await createAuditLogInTransaction(transaction, {
        action: "USER_BANNED",
        actorId,
        clubId,
        reportId: report.id,
        postId: target.targetType === "POST" ? target.id : report.postId,
        commentId: target.targetType === "COMMENT" ? target.id : null,
        targetUserId: target.authorId,
        moderatorNote: input.moderatorNote,
        metadata: {
          banId: ban.id,
          expiresAt: expiresAt?.toISOString() ?? null,
          targetType: target.targetType
        }
      });

      return {
        status: "SUCCESS"
      };
    }),

  resolveModerationReport: (clubId, reportId, actorId, input) =>
    prisma.$transaction(async (transaction) => {
      const report = await findReportForAction(transaction, clubId, reportId);

      if (!report) {
        return {
          status: "REPORT_NOT_FOUND"
        };
      }

      await transaction.report.update({
        where: {
          id: report.id
        },
        data: {
          status: input.status
        },
        select: {
          id: true
        }
      });
      await createAuditLogInTransaction(transaction, {
        action: input.status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
        actorId,
        clubId,
        reportId: report.id,
        postId: report.postId,
        commentId: report.commentId,
        targetUserId: getActionTarget(report)?.authorId ?? null,
        moderatorNote: input.moderatorNote,
        metadata: {
          previousStatus: report.status,
          status: input.status
        }
      });

      const updatedReport = await findSelectedModerationReportById(
        transaction,
        clubId,
        report.id
      );

      return {
        status: "SUCCESS",
        report: toModerationReportRecord(updatedReport)
      };
    })
};

type TransactionClient = Prisma.TransactionClient;

type ActionReportRecord = Prisma.ReportGetPayload<{
  select: typeof actionReportSelect;
}>;

type ActionTarget =
  | {
      targetType: "POST";
      id: string;
      authorId: string;
      status: "VISIBLE" | "HIDDEN";
      deletedAt: Date | null;
      requiredMilestoneId: string;
      requiredMilestone: {
        position: number;
      };
    }
  | {
      targetType: "COMMENT";
      id: string;
      authorId: string;
      status: "VISIBLE" | "HIDDEN";
      deletedAt: Date | null;
      requiredMilestoneId: string;
      requiredMilestone: {
        position: number;
      };
    };

const actionReportSelect = {
  id: true,
  targetType: true,
  status: true,
  clubId: true,
  postId: true,
  commentId: true,
  club: {
    select: {
      title: true
    }
  },
  post: {
    select: {
      id: true,
      authorId: true,
      status: true,
      deletedAt: true,
      requiredMilestoneId: true,
      requiredMilestone: {
        select: {
          position: true
        }
      }
    }
  },
  comment: {
    select: {
      id: true,
      authorId: true,
      status: true,
      deletedAt: true,
      requiredMilestoneId: true,
      requiredMilestone: {
        select: {
          position: true
        }
      }
    }
  }
} satisfies Prisma.ReportSelect;

const runContentActionTransaction = (
  clubId: string,
  reportId: string,
  actorId: string,
  action: (input: {
    report: ActionReportRecord;
    target: ActionTarget;
    transaction: TransactionClient;
  }) => Promise<
    | { status: "SUCCESS"; notification?: CreateNotificationResult }
    | { status: "MILESTONE_NOT_FOUND" }
  >
): Promise<ModerationActionRepositoryResult> =>
  prisma.$transaction(async (transaction) => {
    const report = await findReportForAction(transaction, clubId, reportId);

    if (!report) {
      return {
        status: "REPORT_NOT_FOUND"
      };
    }

    if (report.status !== "OPEN") {
      return {
        status: "REPORT_CLOSED"
      };
    }

    const target = getActionTarget(report);

    if (!target) {
      return {
        status: "TARGET_NOT_FOUND"
      };
    }

    const result = await action({
      report,
      target,
      transaction
    });

    if (result.status !== "SUCCESS") {
      return result;
    }

    const updatedReport = await findSelectedModerationReportById(
      transaction,
      clubId,
      report.id
    );

    return {
      status: "SUCCESS",
      report: toModerationReportRecord(updatedReport),
      ...(result.notification ? { notification: result.notification } : {})
    };
  });

const findReportForAction = (
  transaction: TransactionClient,
  clubId: string,
  reportId: string
) =>
  transaction.report.findFirst({
    where: {
      id: reportId,
      clubId
    },
    select: actionReportSelect
  });

const findSelectedModerationReportById = async (
  transaction: TransactionClient,
  clubId: string,
  reportId: string
) => {
  const report = await transaction.report.findFirstOrThrow({
    where: {
      id: reportId,
      clubId
    },
    select: moderationReportSelect
  });

  return report;
};

const getActionTarget = (report: ActionReportRecord): ActionTarget | null => {
  if (report.targetType === "POST" && report.post) {
    return {
      targetType: "POST",
      ...report.post
    };
  }

  if (report.targetType === "COMMENT" && report.comment) {
    return {
      targetType: "COMMENT",
      ...report.comment
    };
  }

  return null;
};

const resolveReportInTransaction = (
  transaction: TransactionClient,
  reportId: string
) =>
  transaction.report.update({
    where: {
      id: reportId
    },
    data: {
      status: "RESOLVED"
    },
    select: {
      id: true
    }
  });

const createAuditLogInTransaction = (
  transaction: TransactionClient,
  input: {
    action: AuditLogAction;
    actorId: string;
    clubId: string;
    reportId: string;
    postId: string | null;
    commentId: string | null;
    targetUserId: string | null;
    moderatorNote?: string;
    metadata: Prisma.InputJsonObject;
  }
) =>
  transaction.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      clubId: input.clubId,
      reportId: input.reportId,
      postId: input.postId,
      commentId: input.commentId,
      targetUserId: input.targetUserId,
      moderatorNote: input.moderatorNote ?? null,
      metadata: input.metadata
    },
    select: {
      id: true
    }
  });

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
