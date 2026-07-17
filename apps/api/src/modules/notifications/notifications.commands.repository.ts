import type { Prisma } from "../../generated/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { NotificationType } from "./notifications.schema.js";
import {
  createNotificationInTransaction,
  type CreateNotificationResult
} from "./notifications.repository.js";

export const createCommentNotificationInTransaction = async (
  transaction: Prisma.TransactionClient,
  commentId: string
): Promise<CreateNotificationResult | null> => {
  const source = await transaction.comment.findFirst({
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

  if (
    !source ||
    (source.parent &&
      (source.parent.status !== "VISIBLE" || source.parent.deletedAt))
  ) {
    return null;
  }

  const recipientUserId = source.parent?.authorId ?? source.post.authorId;

  if (recipientUserId === source.authorId) {
    return null;
  }

  const type: NotificationType = source.parent
    ? "COMMENT_REPLY"
    : "POST_COMMENT";

  return createNotificationInTransaction(transaction, {
    userId: recipientUserId,
    type,
    eventKey: getCommentNotificationEventKey({
      commentId: source.id,
      recipientUserId,
      type
    }),
    safeText:
      type === "COMMENT_REPLY"
        ? `New reply in ${source.post.club.title}`
        : `New comment in ${source.post.club.title}`,
    clubId: source.post.clubId,
    postId: source.post.id,
    commentId: source.id,
    requiredMilestoneId: source.requiredMilestoneId
  });
};

export const createProgressUnlockNotificationInTransaction = async (
  transaction: Prisma.TransactionClient,
  progressHistoryId: string
): Promise<CreateNotificationResult | null> => {
  const history = await transaction.progressHistory.findUnique({
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

  const [totalMilestones, currentProgress] = await Promise.all([
    transaction.milestone.count({
      where: {
        clubId: history.clubId
      }
    }),
    transaction.clubProgress.findUnique({
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
  const currentPosition = getSafeProgressPosition({
    mode: (currentProgress?.mode ?? "STRICT") as ProgressMode,
    milestonePosition: currentProgress?.currentMilestone?.position ?? null,
    totalMilestones
  });
  const effectiveToPosition = Math.min(toPosition, currentPosition);

  if (effectiveToPosition <= fromPosition) {
    return null;
  }

  const unlockedPost = await transaction.post.findFirst({
    where: {
      clubId: history.clubId,
      status: "VISIBLE",
      deletedAt: null,
      requiredMilestone: {
        position: {
          gt: fromPosition,
          lte: effectiveToPosition
        }
      }
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

  if (!unlockedPost) {
    return null;
  }

  return createNotificationInTransaction(transaction, {
    userId: history.userId,
    type: "PROGRESS_UNLOCK",
    eventKey: getProgressUnlockNotificationEventKey({
      progressHistoryId: history.id,
      userId: history.userId
    }),
    safeText: `New discussions unlocked in ${history.club.title}`,
    clubId: history.clubId,
    postId: unlockedPost.id,
    commentId: null,
    requiredMilestoneId: unlockedPost.requiredMilestoneId
  });
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
}) => (mode === "FINISHED" ? totalMilestones : (milestonePosition ?? 0));
