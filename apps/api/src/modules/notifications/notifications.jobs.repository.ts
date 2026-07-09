import { prisma } from "../../core/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { NotificationType } from "./notifications.schema.js";
import {
  createNotificationInTransaction,
  type CreateCommentNotificationInput,
  type CreateNotificationResult
} from "./notifications.repository.js";

export type CommentNotificationSource = {
  commentId: string;
  commentAuthorId: string;
  postId: string;
  postAuthorId: string;
  clubId: string;
  clubTitle: string;
  parentAuthorId: string | null;
  requiredMilestoneId: string;
};

export type ProgressUnlockNotificationSource = {
  progressHistoryId: string;
  userId: string;
  clubId: string;
  clubTitle: string;
  requiredMilestoneId: string | null;
  unlockedPostId: string | null;
};

export type NotificationsJobsRepository = {
  findCommentNotificationSource: (
    commentId: string
  ) => Promise<CommentNotificationSource | null>;
  findProgressUnlockNotificationSource: (
    progressHistoryId: string
  ) => Promise<ProgressUnlockNotificationSource | null>;
  createNotificationIfMissing: (
    input: CreateCommentNotificationInput
  ) => Promise<CreateNotificationResult | null>;
};

export const notificationsJobsRepository: NotificationsJobsRepository = {
  findCommentNotificationSource: async (commentId) => {
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
        authorId: true,
        requiredMilestoneId: true,
        parent: {
          select: {
            authorId: true,
            status: true,
            deletedAt: true
          }
        },
        post: {
          select: {
            id: true,
            authorId: true,
            clubId: true,
            club: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    if (!comment) {
      return null;
    }

    if (
      comment.parent &&
      (comment.parent.status !== "VISIBLE" || comment.parent.deletedAt)
    ) {
      return null;
    }

    return {
      commentId: comment.id,
      commentAuthorId: comment.authorId,
      postId: comment.post.id,
      postAuthorId: comment.post.authorId,
      clubId: comment.post.clubId,
      clubTitle: comment.post.club.title,
      parentAuthorId: comment.parent?.authorId ?? null,
      requiredMilestoneId: comment.requiredMilestoneId
    };
  },

  findProgressUnlockNotificationSource: async (progressHistoryId) => {
    const history = await prisma.progressHistory.findUnique({
      where: {
        id: progressHistoryId
      },
      select: {
        id: true,
        userId: true,
        clubId: true,
        fromMode: true,
        toMode: true,
        fromMilestone: {
          select: {
            position: true
          }
        },
        toMilestone: {
          select: {
            position: true
          }
        },
        club: {
          select: {
            title: true
          }
        }
      }
    });

    if (!history) {
      return null;
    }

    const [totalMilestones, currentProgress] = await prisma.$transaction([
      prisma.milestone.count({
        where: {
          clubId: history.clubId
        }
      }),
      prisma.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId: history.userId,
            clubId: history.clubId
          }
        },
        select: {
          mode: true,
          currentMilestone: {
            select: {
              position: true
            }
          }
        }
      })
    ]);
    const fromPosition = getSafeProgressPosition({
      mode: history.fromMode as ProgressMode,
      milestonePosition: history.fromMilestone?.position ?? null,
      totalMilestones
    });
    const toPosition = getSafeProgressPosition({
      mode: history.toMode as ProgressMode,
      milestonePosition: history.toMilestone?.position ?? null,
      totalMilestones
    });
    const currentSafePosition = getSafeProgressPosition({
      mode: (currentProgress?.mode ?? "STRICT") as ProgressMode,
      milestonePosition: currentProgress?.currentMilestone?.position ?? null,
      totalMilestones
    });
    const effectiveToPosition = Math.min(toPosition, currentSafePosition);

    if (effectiveToPosition <= fromPosition) {
      return {
        progressHistoryId: history.id,
        userId: history.userId,
        clubId: history.clubId,
        clubTitle: history.club.title,
        requiredMilestoneId: null,
        unlockedPostId: null
      };
    }

    const unlockedPost = await prisma.post.findFirst({
      where: {
        clubId: history.clubId,
        status: "VISIBLE",
        deletedAt: null,
        requiredMilestone: {
          position: {
            gt: fromPosition,
            lte: effectiveToPosition
          }
        },
      },
      orderBy: [
        {
          requiredMilestone: {
            position: "desc"
          }
        },
        {
          createdAt: "desc"
        },
        {
          id: "asc"
        }
      ],
      select: {
        id: true,
        requiredMilestoneId: true
      }
    });

    return {
      progressHistoryId: history.id,
      userId: history.userId,
      clubId: history.clubId,
      clubTitle: history.club.title,
      requiredMilestoneId: unlockedPost?.requiredMilestoneId ?? null,
      unlockedPostId: unlockedPost?.id ?? null
    };
  },

  createNotificationIfMissing: async (input) =>
    prisma.$transaction((transaction) =>
      createNotificationInTransaction(transaction, input)
    )
};

export const getCommentNotificationEventKey = ({
  commentId,
  recipientUserId,
  type
}: {
  commentId: string;
  recipientUserId: string;
  type: NotificationType;
}) => `comment-notification:${type}:${recipientUserId}:${commentId}`;

export const getProgressUnlockNotificationEventKey = ({
  progressHistoryId,
  userId
}: {
  progressHistoryId: string;
  userId: string;
}) => `progress-unlock:${userId}:${progressHistoryId}`;

const getSafeProgressPosition = ({
  milestonePosition,
  mode,
  totalMilestones
}: {
  mode: ProgressMode;
  milestonePosition: number | null;
  totalMilestones: number;
}) => {
  if (mode === "FINISHED") {
    return totalMilestones;
  }

  return milestonePosition ?? 0;
};
