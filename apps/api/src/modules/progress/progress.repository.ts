import { prisma } from "../../core/prisma/client.js";
import { HttpError } from "../../core/errors/http-error.js";
import { lockClubAuthorization } from "../clubs/club-authorization-lock.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { createProgressUnlockNotificationInTransaction } from "../notifications/notifications.commands.repository.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import {
  postSelect,
  toClubPostRecord,
  userReactionMapForPostIds
} from "../posts/posts.repository.js";
import type { ProgressMode } from "./progress.schema.js";
import type {
  ClubProgressRecord,
  ProgressHistoryRecord,
  ProgressMilestoneRecord,
  ProgressRepository,
  RecentlyUnlockedRecord
} from "./progress.repository.types.js";

export type * from "./progress.repository.types.js";

const milestoneSelect = {
  id: true,
  position: true,
  safeTitle: true,
  fullTitle: true,
  spoilerName: true
} as const;

const historySelect = {
  id: true,
  fromMode: true,
  toMode: true,
  fromMilestone: {
    select: milestoneSelect
  },
  toMilestone: {
    select: milestoneSelect
  },
  createdAt: true
} as const;

export const progressRepository: ProgressRepository = {
  findClubForProgress: async (linkName, userId) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
      },
      select: {
        id: true,
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
      currentUserRole: club.memberships[0]?.role ?? null,
      isCurrentUserBanned: club.bans.length > 0
    };
  },

  getProgressForUserClub: async (userId, clubId) => {
    const [progress, totalMilestones, history] = await prisma.$transaction([
      prisma.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          id: true,
          mode: true,
          currentMilestone: {
            select: milestoneSelect
          },
          onboardingCompletedAt: true,
          updatedAt: true
        }
      }),
      prisma.milestone.count({
        where: {
          clubId
        }
      }),
      prisma.progressHistory.findMany({
        where: {
          userId,
          clubId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: historySelect
      })
    ]);

    return {
      id: progress?.id ?? null,
      mode: (progress?.mode ?? "STRICT") as ProgressMode,
      currentMilestone: progress?.currentMilestone ?? null,
      totalMilestones,
      history: history.map(toProgressHistoryRecord),
      onboardingCompletedAt: progress?.onboardingCompletedAt ?? null,
      updatedAt: progress?.updatedAt ?? null
    };
  },

  advanceProgressToNextMilestoneForUserClub: async (
    userId,
    clubId,
    commandId
  ) =>
    prisma.$transaction(async (transaction) => {
      await lockClubAuthorization(transaction, clubId);
      await lockUserClubProgress(transaction, userId, clubId);
      const isDuplicate = await isDuplicateProgressCommand(transaction, {
        userId,
        clubId,
        commandId,
        type: "ADVANCE_NEXT",
        fingerprint: "next"
      });

      if (isDuplicate) {
        return readProgressRecord(transaction, userId, clubId);
      }

      const existingProgress = await transaction.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          mode: true,
          version: true,
          currentMilestoneId: true,
          onboardingCompletedAt: true,
          currentMilestone: {
            select: {
              position: true
            }
          }
        }
      });
      const currentPosition =
        existingProgress?.currentMilestone?.position ?? null;
      const nextMilestone = await transaction.milestone.findFirst({
        where: {
          clubId,
          ...(currentPosition === null
            ? {}
            : {
                position: {
                  gt: currentPosition
                }
              })
        },
        orderBy: {
          position: "asc"
        },
        select: {
          id: true,
          position: true
        }
      });

      if (!nextMilestone) {
        const mode = (existingProgress?.mode ?? "STRICT") as ProgressMode;
        const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
        const onboardingCompletedAt =
          existingProgress?.onboardingCompletedAt ?? new Date();
        const hasProgressStateChange =
          currentPosition !== null && mode !== "FINISHED";
        const nextVersion =
          (existingProgress?.version ?? 0) + (hasProgressStateChange ? 1 : 0);

        if (
          existingProgress &&
          currentPosition !== null &&
          (mode !== "FINISHED" || !existingProgress.onboardingCompletedAt)
        ) {
          await transaction.clubProgress.update({
            where: {
              userId_clubId: {
                userId,
                clubId
              }
            },
            data: {
              mode: "FINISHED",
              onboardingCompletedAt,
              ...(hasProgressStateChange
                ? {
                    version: nextVersion
                  }
                : {})
            },
            select: {
              id: true
            }
          });
        }

        if (currentPosition !== null && mode !== "FINISHED") {
          const progressHistory = await transaction.progressHistory.create({
            data: {
              userId,
              clubId,
              fromMilestoneId,
              toMilestoneId: fromMilestoneId,
              fromMode: mode,
              toMode: "FINISHED",
              version: nextVersion
            },
            select: {
              id: true
            }
          });

          await createProgressUnlockNotificationInTransaction(
            transaction,
            progressHistory.id
          );
        }

        await recordProgressCommand(transaction, {
          userId,
          clubId,
          commandId,
          type: "ADVANCE_NEXT",
          fingerprint: "next"
        });

        return readProgressRecord(transaction, userId, clubId);
      }

      const mode = (existingProgress?.mode ?? "STRICT") as ProgressMode;
      const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
      const onboardingCompletedAt =
        existingProgress?.onboardingCompletedAt ?? new Date();
      const nextVersion = (existingProgress?.version ?? 0) + 1;
      const laterMilestone = await transaction.milestone.findFirst({
        where: {
          clubId,
          position: {
            gt: nextMilestone.position
          }
        },
        select: {
          id: true
        }
      });
      const nextMode: ProgressMode = laterMilestone ? mode : "FINISHED";

      await transaction.clubProgress.upsert({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        create: {
          userId,
          clubId,
          currentMilestoneId: nextMilestone.id,
          mode: nextMode,
          onboardingCompletedAt,
          version: nextVersion
        },
        update: {
          currentMilestoneId: nextMilestone.id,
          mode: nextMode,
          onboardingCompletedAt,
          version: nextVersion
        },
        select: {
          id: true
        }
      });

      const progressHistory = await transaction.progressHistory.create({
        data: {
          userId,
          clubId,
          fromMilestoneId,
          toMilestoneId: nextMilestone.id,
          fromMode: mode,
          toMode: nextMode,
          version: nextVersion
        },
        select: {
          id: true
        }
      });

      await createProgressUnlockNotificationInTransaction(
        transaction,
        progressHistory.id
      );
      await recordProgressCommand(transaction, {
        userId,
        clubId,
        commandId,
        type: "ADVANCE_NEXT",
        fingerprint: "next"
      });

      return readProgressRecord(transaction, userId, clubId);
    }),

  updateProgressForUserClub: async (userId, clubId, input, commandId) =>
    prisma.$transaction(async (transaction) => {
      await lockClubAuthorization(transaction, clubId);
      await lockUserClubProgress(transaction, userId, clubId);
      const fingerprint = `${input.mode}:${input.currentMilestoneId ?? "none"}`;
      const isDuplicate = await isDuplicateProgressCommand(transaction, {
        userId,
        clubId,
        commandId,
        type: "UPDATE",
        fingerprint
      });

      if (isDuplicate) {
        return readProgressRecord(transaction, userId, clubId);
      }

      if (input.currentMilestoneId) {
        const milestone = await transaction.milestone.findFirst({
          where: {
            id: input.currentMilestoneId,
            clubId
          },
          select: {
            id: true
          }
        });

        if (!milestone) {
          return null;
        }
      }

      const existingProgress = await transaction.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          id: true,
          mode: true,
          currentMilestoneId: true,
          onboardingCompletedAt: true,
          version: true
        }
      });

      const onboardingCompletedAt =
        existingProgress?.onboardingCompletedAt ?? new Date();
      const fromMode = (existingProgress?.mode ?? "STRICT") as ProgressMode;
      const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
      const hasChanged =
        fromMode !== input.mode || fromMilestoneId !== input.currentMilestoneId;
      const nextVersion =
        (existingProgress?.version ?? 0) + (hasChanged ? 1 : 0);

      await transaction.clubProgress.upsert({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        create: {
          userId,
          clubId,
          currentMilestoneId: input.currentMilestoneId,
          mode: input.mode,
          onboardingCompletedAt,
          version: nextVersion
        },
        update: {
          currentMilestoneId: input.currentMilestoneId,
          mode: input.mode,
          onboardingCompletedAt,
          ...(hasChanged
            ? {
                version: nextVersion
              }
            : {})
        },
        select: {
          id: true
        }
      });

      if (hasChanged) {
        const progressHistory = await transaction.progressHistory.create({
          data: {
            userId,
            clubId,
            fromMilestoneId,
            toMilestoneId: input.currentMilestoneId,
            fromMode,
            toMode: input.mode,
            version: nextVersion
          },
          select: {
            id: true
          }
        });

        await createProgressUnlockNotificationInTransaction(
          transaction,
          progressHistory.id
        );
      }
      await recordProgressCommand(transaction, {
        userId,
        clubId,
        commandId,
        type: "UPDATE",
        fingerprint
      });

      return readProgressRecord(transaction, userId, clubId);
    }),

  listRecentlyUnlockedPostsForUserClub: async (
    userId,
    clubId,
    { cursor, limit }
  ) => {
    const [latestHistory, totalMilestones, progress] =
      await prisma.$transaction([
        prisma.progressHistory.findFirst({
          where: {
            userId,
            clubId
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
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
            createdAt: true
          }
        }),
        prisma.milestone.count({
          where: {
            clubId
          }
        }),
        prisma.clubProgress.findUnique({
          where: {
            userId_clubId: {
              userId,
              clubId
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
    const currentProgress = {
      mode: (progress?.mode ?? "STRICT") as ProgressMode,
      currentMilestonePosition: progress?.currentMilestone?.position ?? null
    };

    if (!latestHistory) {
      return emptyRecentlyUnlockedResult(currentProgress);
    }

    const fromPosition = getSafeProgressPosition({
      mode: latestHistory.fromMode as ProgressMode,
      milestonePosition: latestHistory.fromMilestone?.position ?? null,
      totalMilestones
    });
    const toPosition = getSafeProgressPosition({
      mode: latestHistory.toMode as ProgressMode,
      milestonePosition: latestHistory.toMilestone?.position ?? null,
      totalMilestones
    });
    const unlock = {
      historyId: latestHistory.id,
      fromPosition,
      toPosition,
      unlockedAt: latestHistory.createdAt
    };
    const currentSafePosition = getSafeProgressPosition({
      mode: currentProgress.mode,
      milestonePosition: currentProgress.currentMilestonePosition,
      totalMilestones
    });
    const effectiveToPosition = Math.min(toPosition, currentSafePosition);

    if (effectiveToPosition <= fromPosition) {
      return {
        ...emptyRecentlyUnlockedResult(currentProgress),
        unlock
      };
    }

    const cursorWhere: Prisma.PostWhereInput = cursor
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
    const posts = await prisma.post.findMany({
      where: {
        clubId,
        status: "VISIBLE",
        deletedAt: null,
        requiredMilestone: {
          position: {
            gt: fromPosition,
            lte: effectiveToPosition
          }
        },
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
      select: postSelect
    });
    const pagePosts = posts.slice(0, limit);
    const lastPost = pagePosts[pagePosts.length - 1];
    const reactionMap = await userReactionMapForPostIds(
      pagePosts.map((post) => post.id),
      userId
    );

    return {
      unlock,
      posts: pagePosts.map((post) => toClubPostRecord(post, reactionMap)),
      nextCursor:
        posts.length > limit && lastPost
          ? {
              createdAt: lastPost.createdAt,
              id: lastPost.id
            }
          : null,
      hasMore: posts.length > limit,
      currentProgress
    };
  }
};

type ProgressCommandInput = {
  userId: string;
  clubId: string;
  commandId: string;
  type: "UPDATE" | "ADVANCE_NEXT";
  fingerprint: string;
};

const lockUserClubProgress = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  clubId: string
) => {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${userId}:${clubId}`}, 0)
    )
  `;

  await transaction.$queryRaw`
    SELECT "id"
    FROM "club_progress"
    WHERE "user_id" = ${userId}::uuid
      AND "club_id" = ${clubId}::uuid
    FOR UPDATE
  `;
};

const isDuplicateProgressCommand = async (
  transaction: Prisma.TransactionClient,
  input: ProgressCommandInput
) => {
  const command = await transaction.progressCommand.findUnique({
    where: {
      userId_clubId_commandId: {
        userId: input.userId,
        clubId: input.clubId,
        commandId: input.commandId
      }
    },
    select: {
      type: true,
      fingerprint: true
    }
  });

  if (!command) {
    return false;
  }

  if (
    command.type !== input.type ||
    command.fingerprint !== input.fingerprint
  ) {
    throw new HttpError(
      409,
      "CONFLICT",
      "This progress command ID was already used for a different update."
    );
  }

  return true;
};

const recordProgressCommand = (
  transaction: Prisma.TransactionClient,
  input: ProgressCommandInput
) =>
  transaction.progressCommand.create({
    data: input,
    select: {
      id: true
    }
  });

const readProgressRecord = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  clubId: string
): Promise<ClubProgressRecord> => {
  const [progress, totalMilestones, history] = await Promise.all([
    transaction.clubProgress.findUnique({
      where: {
        userId_clubId: {
          userId,
          clubId
        }
      },
      select: {
        id: true,
        mode: true,
        currentMilestone: {
          select: milestoneSelect
        },
        onboardingCompletedAt: true,
        updatedAt: true
      }
    }),
    transaction.milestone.count({
      where: {
        clubId
      }
    }),
    transaction.progressHistory.findMany({
      where: {
        userId,
        clubId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5,
      select: historySelect
    })
  ]);

  return {
    id: progress?.id ?? null,
    mode: (progress?.mode ?? "STRICT") as ProgressMode,
    currentMilestone: progress?.currentMilestone ?? null,
    totalMilestones,
    history: history.map(toProgressHistoryRecord),
    onboardingCompletedAt: progress?.onboardingCompletedAt ?? null,
    updatedAt: progress?.updatedAt ?? null
  };
};

const toProgressHistoryRecord = (history: {
  id: string;
  fromMode: string;
  toMode: string;
  fromMilestone: ProgressMilestoneRecord | null;
  toMilestone: ProgressMilestoneRecord | null;
  createdAt: Date;
}): ProgressHistoryRecord => ({
  id: history.id,
  fromMode: history.fromMode as ProgressMode,
  toMode: history.toMode as ProgressMode,
  fromMilestone: history.fromMilestone,
  toMilestone: history.toMilestone,
  createdAt: history.createdAt
});

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

const emptyRecentlyUnlockedResult = (
  currentProgress: RecentlyUnlockedRecord["currentProgress"]
): RecentlyUnlockedRecord => ({
  unlock: {
    historyId: null,
    fromPosition: 0,
    toPosition: 0,
    unlockedAt: null
  },
  posts: [],
  nextCursor: null,
  hasMore: false,
  currentProgress
});
