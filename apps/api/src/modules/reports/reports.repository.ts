import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { createAuditLogInTransaction } from "../audit/audit-log.repository.js";
import {
  createNotificationInTransaction,
  type CreateNotificationResult
} from "../notifications/notifications.repository.js";
import {
  activeBanWhere,
  activeUserBanWhere,
  canActorBanTarget
} from "../clubs/club-bans.js";
import { softDeleteAuthoredPostsForBan } from "../clubs/club-ban-cleanup.js";
import { lockClubAuthorizationChanges } from "../clubs/club-authorization-lock.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type {
  ModerationActionRepositoryResult,
  ModerationReportRecord,
  ReportRecord,
  ReportsRepository
} from "./reports.repository.types.js";

export type * from "./reports.repository.types.js";

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
        isCurrentUserBanned: post.club.bans.length > 0,
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
        isCurrentUserBanned: comment.post.club.bans.length > 0,
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

  findClubAccessByLinkName: async (linkName, userId) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
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
        },
        bans: {
          where: activeUserBanWhere(userId, now),
          select: {
            id: true
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
      currentUserRole: club.memberships[0]?.role ?? null,
      isCurrentUserBanned: club.bans.length > 0
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
    runContentActionTransaction(
      clubId,
      reportId,
      actorId,
      async ({ report, target, transaction }) => {
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
            previousRequiredMilestonePosition:
              target.requiredMilestone.position,
            requiredMilestoneId: milestone.id,
            requiredMilestonePosition: milestone.position
          }
        });

        return {
          status: "SUCCESS"
        };
      }
    ),

  hideReportedContent: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(
      clubId,
      reportId,
      actorId,
      async ({ report, target, transaction }) => {
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
          action:
            target.targetType === "POST" ? "POST_HIDDEN" : "COMMENT_HIDDEN",
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
      }
    ),

  deleteReportedContent: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(
      clubId,
      reportId,
      actorId,
      async ({ report, target, transaction }) => {
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
      }
    ),

  warnReportedContentAuthor: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(
      clubId,
      reportId,
      actorId,
      async ({ report, target, transaction }) => {
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

        const notification = await createNotificationInTransaction(
          transaction,
          {
            userId: target.authorId,
            type: "MODERATION_WARNING",
            eventKey: `moderation-warning:${report.id}:${target.authorId}`,
            safeText: `A moderator issued a warning in ${report.club.title}.`,
            clubId,
            postId: target.targetType === "POST" ? target.id : report.postId,
            commentId: target.targetType === "COMMENT" ? target.id : null,
            requiredMilestoneId: target.requiredMilestoneId
          }
        );

        return {
          status: "SUCCESS",
          ...(notification ? { notification } : {})
        };
      }
    ),

  banReportedContentAuthor: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(
      clubId,
      reportId,
      actorId,
      async ({ report, target, transaction }) => {
        const banContext = await findReportBanContext(
          transaction,
          clubId,
          actorId,
          target.authorId
        );

        if (
          !banContext.actorRole ||
          (banContext.targetRole &&
            !canActorBanTarget(banContext.actorRole, banContext.targetRole))
        ) {
          return {
            status: "TARGET_PROTECTED"
          };
        }

        if (banContext.targetRole === "OWNER" && banContext.ownerCount <= 1) {
          return {
            status: "LAST_OWNER"
          };
        }

        const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
        const activeBan = await transaction.clubBan.findFirst({
          where: {
            clubId,
            userId: target.authorId,
            ...activeBanWhere(new Date())
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
                reason: "Moderation action",
                roleAtBan: banContext.targetRole
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
                reason: "Moderation action",
                roleAtBan: banContext.targetRole
              },
              select: {
                id: true
              }
            });
        const deletedPostCount = input.deleteAuthoredPosts
          ? await softDeleteAuthoredPostsForBan(transaction, {
              actorId,
              banId: ban.id,
              clubId,
              moderatorNote: input.moderatorNote,
              reportId: report.id,
              targetUserId: target.authorId
            })
          : 0;

        if (banContext.targetMembershipId) {
          await transaction.clubMembership.delete({
            where: {
              id: banContext.targetMembershipId
            },
            select: {
              id: true
            }
          });
        }

        await transaction.notification.deleteMany({
          where: {
            clubId,
            userId: target.authorId
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
            deletedPostCount,
            deleteAuthoredPosts: Boolean(input.deleteAuthoredPosts),
            membershipId: banContext.targetMembershipId,
            roleAtBan: banContext.targetRole,
            targetType: target.targetType
          }
        });

        return {
          status: "SUCCESS",
          deletedPostCount
        };
      }
    ),

  resolveModerationReport: (clubId, reportId, actorId, input) =>
    runContentActionTransaction(
      clubId,
      reportId,
      actorId,
      async ({ report, target, transaction }) => {
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
          action:
            input.status === "RESOLVED"
              ? "REPORT_RESOLVED"
              : "REPORT_DISMISSED",
          actorId,
          clubId,
          reportId: report.id,
          postId: report.postId,
          commentId: report.commentId,
          targetUserId: target.authorId,
          moderatorNote: input.moderatorNote,
          metadata: {
            previousStatus: report.status,
            status: input.status
          }
        });

        return {
          status: "SUCCESS"
        };
      }
    )
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
    | {
        status: "SUCCESS";
        deletedPostCount?: number;
        notification?: CreateNotificationResult;
      }
    | { status: "MILESTONE_NOT_FOUND" }
    | { status: "TARGET_PROTECTED" }
    | { status: "LAST_OWNER" }
  >
): Promise<ModerationActionRepositoryResult> =>
  prisma.$transaction(async (transaction) => {
    if (!(await lockClubAuthorizationChanges(transaction, clubId))) {
      return {
        status: "ACCESS_DENIED"
      };
    }

    const now = new Date();
    const actorAccess = await transaction.club.findFirst({
      where: {
        id: clubId,
        memberships: {
          some: {
            userId: actorId,
            role: {
              in: ["OWNER", "MODERATOR"]
            }
          }
        },
        bans: {
          none: activeUserBanWhere(actorId, now)
        }
      },
      select: {
        id: true
      }
    });

    if (!actorAccess) {
      return {
        status: "ACCESS_DENIED"
      };
    }

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
      ...(result.deletedPostCount !== undefined
        ? { deletedPostCount: result.deletedPostCount }
        : {}),
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

const findReportBanContext = async (
  transaction: TransactionClient,
  clubId: string,
  actorId: string,
  targetUserId: string
) => {
  const [actorMembership, targetMembership, ownerCount] = await Promise.all([
    transaction.clubMembership.findUnique({
      where: {
        userId_clubId: {
          userId: actorId,
          clubId
        }
      },
      select: {
        role: true
      }
    }),
    transaction.clubMembership.findUnique({
      where: {
        userId_clubId: {
          userId: targetUserId,
          clubId
        }
      },
      select: {
        id: true,
        role: true
      }
    }),
    transaction.clubMembership.count({
      where: {
        clubId,
        role: "OWNER"
      }
    })
  ]);

  return {
    actorRole: actorMembership?.role ?? null,
    targetMembershipId: targetMembership?.id ?? null,
    targetRole: targetMembership?.role ?? null,
    ownerCount
  };
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

const clubAccessSelect = (userId: string) => {
  const now = new Date();

  return {
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
    bans: {
      where: activeUserBanWhere(userId, now),
      select: {
        id: true
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
  } satisfies Prisma.ClubSelect;
};

const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
