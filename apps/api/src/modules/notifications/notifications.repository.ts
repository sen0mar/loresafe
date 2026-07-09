import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import { lockClubAuthorization } from "../clubs/club-authorization-lock.js";
import type { NotificationType } from "./notifications.schema.js";

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  safeText: string;
  club: {
    id: string;
    title: string;
    linkName: string;
  };
  postId: string | null;
  commentId: string | null;
  requiredMilestone: {
    id: string;
    position: number;
    safeTitle: string;
    targetPostId: string | null;
  };
  progress: {
    mode: ProgressMode;
    currentMilestonePosition: number | null;
  };
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationsCursor = {
  createdAt: Date;
  id: string;
};

export type ListNotificationsResult = {
  notifications: NotificationRecord[];
  nextCursor: NotificationsCursor | null;
  hasMore: boolean;
  unreadCount: number;
};

export type ListNotificationsInput = {
  cursor: NotificationsCursor | null;
  limit: number;
};

export type CreateCommentNotificationInput = {
  userId: string;
  type: NotificationType;
  eventKey: string;
  safeText: string;
  clubId: string;
  postId: string | null;
  commentId: string | null;
  requiredMilestoneId: string;
};

export type CreateNotificationResult = {
  id: string;
  userId: string;
  club: {
    id: string;
    linkName: string;
  };
  postId: string | null;
  commentId: string | null;
  createdAt: Date;
  wasCreated: boolean;
};

export type NotificationsRepository = {
  listNotificationsForUser: (
    userId: string,
    input: ListNotificationsInput
  ) => Promise<ListNotificationsResult>;
  markNotificationRead: (
    notificationId: string,
    userId: string
  ) => Promise<{
    notification: NotificationRecord;
    unreadCount: number;
  } | null>;
  markAllNotificationsRead: (userId: string) => Promise<{
    updatedCount: number;
    unreadCount: number;
  }>;
  deleteNotification: (
    notificationId: string,
    userId: string
  ) => Promise<{
    deletedCount: number;
    unreadCount: number;
  } | null>;
  deleteSelectedNotifications: (
    notificationIds: string[],
    userId: string
  ) => Promise<{
    deletedCount: number;
    unreadCount: number;
  }>;
  deleteAllNotifications: (userId: string) => Promise<{
    deletedCount: number;
    unreadCount: number;
  }>;
};

const notificationSelect = (userId: string) =>
  ({
    id: true,
    type: true,
    safeText: true,
    club: {
      select: {
        id: true,
        title: true,
        linkName: true,
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
      }
    },
    postId: true,
    commentId: true,
    requiredMilestone: {
      select: {
        id: true,
        position: true,
        safeTitle: true,
        posts: {
          where: {
            status: "VISIBLE",
            deletedAt: null
          },
          orderBy: [
            {
              createdAt: "desc"
            },
            {
              id: "asc"
            }
          ] satisfies Prisma.PostOrderByWithRelationInput[],
          select: {
            id: true
          },
          take: 1
        }
      }
    },
    readAt: true,
    createdAt: true
  }) as const;

export const buildAccessibleNotificationWhere = (
  userId: string,
  now = new Date()
): Prisma.NotificationWhereInput => ({
  userId,
  club: {
    bans: {
      none: activeUserBanWhere(userId, now)
    },
    OR: [
      {
        visibility: "PUBLIC"
      },
      {
        memberships: {
          some: {
            userId
          }
        }
      }
    ]
  },
  OR: [
    {
      commentId: {
        not: null
      },
      comment: {
        status: "VISIBLE",
        deletedAt: null,
        post: {
          status: "VISIBLE",
          deletedAt: null
        }
      }
    },
    {
      commentId: null,
      postId: {
        not: null
      },
      post: {
        status: "VISIBLE",
        deletedAt: null
      }
    },
    {
      commentId: null,
      postId: null
    }
  ]
});

export const buildNotificationListWhere = (
  userId: string,
  cursor: NotificationsCursor | null,
  now = new Date()
): Prisma.NotificationWhereInput => {
  const cursorWhere: Prisma.NotificationWhereInput = cursor
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

  return {
    AND: [buildAccessibleNotificationWhere(userId, now), cursorWhere]
  };
};

export const notificationsRepository: NotificationsRepository = {
  listNotificationsForUser: async (userId, { cursor, limit }) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: buildNotificationListWhere(userId, cursor),
        orderBy: [
          {
            createdAt: "desc"
          },
          {
            id: "asc"
          }
        ],
        take: limit + 1,
        select: notificationSelect(userId)
      }),
      prisma.notification.count({
        where: {
          ...buildAccessibleNotificationWhere(userId),
          readAt: null
        }
      })
    ]);
    const pageNotifications = notifications.slice(0, limit);
    const lastNotification = pageNotifications[pageNotifications.length - 1];

    return {
      notifications: pageNotifications.map(toNotificationRecord),
      nextCursor:
        notifications.length > limit && lastNotification
          ? {
              createdAt: lastNotification.createdAt,
              id: lastNotification.id
            }
          : null,
      hasMore: notifications.length > limit,
      unreadCount
    };
  },

  markNotificationRead: async (notificationId, userId) =>
    prisma.$transaction(async (transaction) => {
      const existingNotification = await transaction.notification.findFirst({
        where: {
          id: notificationId,
          ...buildAccessibleNotificationWhere(userId)
        },
        select: {
          id: true,
          clubId: true
        }
      });

      if (
        !existingNotification ||
        !(await lockClubAuthorization(
          transaction,
          existingNotification.clubId
        ))
      ) {
        return null;
      }

      const currentlyAccessible = await transaction.notification.findFirst({
        where: {
          id: notificationId,
          ...buildAccessibleNotificationWhere(userId)
        },
        select: {
          id: true
        }
      });

      if (!currentlyAccessible) {
        return null;
      }

      const notification = await transaction.notification.update({
        where: {
          id: existingNotification.id
        },
        data: {
          readAt: new Date()
        },
        select: notificationSelect(userId)
      });
      const unreadCount = await transaction.notification.count({
        where: {
          ...buildAccessibleNotificationWhere(userId),
          readAt: null
        }
      });

      return {
        notification: toNotificationRecord(notification),
        unreadCount
      };
    }),

  markAllNotificationsRead: async (userId) =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.notification.updateMany({
        where: {
          ...buildAccessibleNotificationWhere(userId),
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      return {
        updatedCount: result.count,
        unreadCount: 0
      };
    }),

  deleteNotification: async (notificationId, userId) =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.notification.deleteMany({
        where: {
          id: notificationId,
          ...buildAccessibleNotificationWhere(userId)
        }
      });

      if (result.count === 0) {
        return null;
      }

      const unreadCount = await transaction.notification.count({
        where: {
          ...buildAccessibleNotificationWhere(userId),
          readAt: null
        }
      });

      return {
        deletedCount: result.count,
        unreadCount
      };
    }),

  deleteSelectedNotifications: async (notificationIds, userId) =>
    prisma.$transaction(async (transaction) => {
      const uniqueNotificationIds = [...new Set(notificationIds)];
      const result = await transaction.notification.deleteMany({
        where: {
          id: {
            in: uniqueNotificationIds
          },
          ...buildAccessibleNotificationWhere(userId)
        }
      });

      const unreadCount = await transaction.notification.count({
        where: {
          ...buildAccessibleNotificationWhere(userId),
          readAt: null
        }
      });

      return {
        deletedCount: result.count,
        unreadCount
      };
    }),

  deleteAllNotifications: async (userId) =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.notification.deleteMany({
        where: {
          userId
        }
      });

      return {
        deletedCount: result.count,
        unreadCount: 0
      };
    })
};

export const createNotificationInTransaction = (
  transaction: Prisma.TransactionClient,
  input: CreateCommentNotificationInput
) =>
  createNotificationIfMissingInTransaction(transaction, input);

const createNotificationIfMissingInTransaction = async (
  transaction: Prisma.TransactionClient,
  input: CreateCommentNotificationInput
): Promise<CreateNotificationResult | null> => {
  if (!(await lockClubAuthorization(transaction, input.clubId))) {
    return null;
  }

  const canReceiveNotification = await hasCurrentNotificationAccess(
    transaction,
    input
  );

  if (!canReceiveNotification) {
    return null;
  }

  try {
    const notification = await transaction.notification.create({
      data: {
        eventKey: input.eventKey,
        userId: input.userId,
        type: input.type,
        safeText: input.safeText,
        clubId: input.clubId,
        postId: input.postId,
        commentId: input.commentId,
        requiredMilestoneId: input.requiredMilestoneId
      },
      select: notificationEventSelect
    });

    return {
      ...notification,
      wasCreated: true
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existingNotification = await transaction.notification.findUnique({
      where: {
        eventKey: input.eventKey
      },
      select: notificationEventSelect
    });

    if (!existingNotification) {
      throw error;
    }

    return {
      ...existingNotification,
      wasCreated: false
    };
  }
};

const hasCurrentNotificationAccess = async (
  transaction: Prisma.TransactionClient,
  input: CreateCommentNotificationInput
) => {
  const now = new Date();
  const club = await transaction.club.findFirst({
    where: {
      id: input.clubId,
      bans: {
        none: activeUserBanWhere(input.userId, now)
      },
      OR: [
        {
          visibility: "PUBLIC"
        },
        {
          memberships: {
            some: {
              userId: input.userId
            }
          }
        }
      ]
    },
    select: {
      id: true
    }
  });

  if (!club) {
    return false;
  }

  if (input.commentId) {
    const comment = await transaction.comment.findFirst({
      where: {
        id: input.commentId,
        postId: input.postId ?? undefined,
        status: "VISIBLE",
        deletedAt: null,
        post: {
          clubId: input.clubId,
          status: "VISIBLE",
          deletedAt: null
        }
      },
      select: {
        id: true
      }
    });

    return Boolean(comment);
  }

  if (input.postId) {
    const post = await transaction.post.findFirst({
      where: {
        id: input.postId,
        clubId: input.clubId,
        status: "VISIBLE",
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    return Boolean(post);
  }

  return true;
};

const notificationEventSelect = {
  id: true,
  userId: true,
  club: {
    select: {
      id: true,
      linkName: true
    }
  },
  postId: true,
  commentId: true,
  createdAt: true
} satisfies Prisma.NotificationSelect;

type SelectedNotification = Prisma.NotificationGetPayload<{
  select: ReturnType<typeof notificationSelect>;
}>;

const toNotificationRecord = (
  notification: SelectedNotification
): NotificationRecord => {
  const progress = notification.club.progress[0];

  return {
    id: notification.id,
    type: notification.type as NotificationType,
    safeText: notification.safeText,
    club: {
      id: notification.club.id,
      title: notification.club.title,
      linkName: notification.club.linkName
    },
    postId: notification.postId,
    commentId: notification.commentId,
    requiredMilestone: {
      id: notification.requiredMilestone.id,
      position: notification.requiredMilestone.position,
      safeTitle: notification.requiredMilestone.safeTitle,
      targetPostId: notification.requiredMilestone.posts[0]?.id ?? null
    },
    progress: {
      mode: (progress?.mode ?? "STRICT") as ProgressMode,
      currentMilestonePosition:
        progress?.currentMilestone?.position ?? null
    },
    readAt: notification.readAt,
    createdAt: notification.createdAt
  };
};

const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
