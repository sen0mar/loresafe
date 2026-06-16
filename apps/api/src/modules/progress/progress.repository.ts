import { prisma } from "../../core/prisma/client.js";
import { enqueueProgressUnlockedNotificationJob } from "../../jobs/notification-job-queue.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ClubPostRecord } from "../posts/posts.repository.js";
import type { PostReactionEmoji } from "../posts/posts.schema.js";
import { postReactionEmojis } from "../posts/posts.schema.js";
import type { ProgressMode, UpdateProgressRequest } from "./progress.schema.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ProgressClubRecord = {
  id: string;
  currentUserRole: ClubMembershipRole | null;
};

export type ProgressMilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  spoilerName: boolean;
};

export type ProgressHistoryRecord = {
  id: string;
  fromMode: ProgressMode;
  toMode: ProgressMode;
  fromMilestone: ProgressMilestoneRecord | null;
  toMilestone: ProgressMilestoneRecord | null;
  createdAt: Date;
};

export type ClubProgressRecord = {
  id: string | null;
  mode: ProgressMode;
  currentMilestone: ProgressMilestoneRecord | null;
  totalMilestones: number;
  history: ProgressHistoryRecord[];
  updatedAt: Date | null;
};

export type RecentlyUnlockedCursor = {
  createdAt: Date;
  id: string;
};

export type RecentlyUnlockedRecord = {
  unlock: {
    historyId: string | null;
    fromPosition: number;
    toPosition: number;
    unlockedAt: Date | null;
  };
  posts: ClubPostRecord[];
  nextCursor: RecentlyUnlockedCursor | null;
  hasMore: boolean;
  currentProgress: {
    mode: ProgressMode;
    currentMilestonePosition: number | null;
  };
};

export type ListRecentlyUnlockedInput = {
  cursor: RecentlyUnlockedCursor | null;
  limit: number;
};

export type ProgressRepository = {
  findClubForProgress: (
    slug: string,
    userId: string
  ) => Promise<ProgressClubRecord | null>;
  advanceProgressToNextMilestoneForUserClub: (
    userId: string,
    clubId: string
  ) => Promise<ClubProgressRecord>;
  getProgressForUserClub: (
    userId: string,
    clubId: string
  ) => Promise<ClubProgressRecord>;
  updateProgressForUserClub: (
    userId: string,
    clubId: string,
    input: UpdateProgressRequest
  ) => Promise<ClubProgressRecord | null>;
  listRecentlyUnlockedPostsForUserClub: (
    userId: string,
    clubId: string,
    input: ListRecentlyUnlockedInput
  ) => Promise<RecentlyUnlockedRecord>;
};

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

const recentlyUnlockedPostSelect = {
  id: true,
  type: true,
  status: true,
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
  },
  prediction: {
    select: {
      status: true,
      revealMilestone: {
        select: {
          id: true,
          position: true,
          safeTitle: true
        }
      }
    }
  },
  _count: {
    select: {
      comments: {
        where: {
          status: "VISIBLE",
          deletedAt: null
        }
      }
    }
  },
  createdAt: true,
  updatedAt: true
} as const;

export const progressRepository: ProgressRepository = {
  findClubForProgress: async (slug, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        slug
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
        }
      }
    });

    if (!club) {
      return null;
    }

    return {
      id: club.id,
      currentUserRole: club.memberships[0]?.role ?? null
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
      updatedAt: progress?.updatedAt ?? null
    };
  },

  advanceProgressToNextMilestoneForUserClub: async (userId, clubId) =>
    prisma.$transaction(async (transaction) => {
      const existingProgress = await transaction.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          mode: true,
          currentMilestoneId: true,
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
          id: true
        }
      });

      if (!nextMilestone) {
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
          updatedAt: progress?.updatedAt ?? null
        };
      }

      const mode = (existingProgress?.mode ?? "STRICT") as ProgressMode;
      const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;

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
          mode
        },
        update: {
          currentMilestoneId: nextMilestone.id
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
          toMode: mode
        },
        select: {
          id: true
        }
      });

      await enqueueProgressUnlockedNotificationJob(
        progressHistory.id,
        transaction
      );

      const [progress, totalMilestones, history] = await Promise.all([
        transaction.clubProgress.findUniqueOrThrow({
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
        id: progress.id,
        mode: progress.mode as ProgressMode,
        currentMilestone: progress.currentMilestone,
        totalMilestones,
        history: history.map(toProgressHistoryRecord),
        updatedAt: progress.updatedAt
      };
    }),

  updateProgressForUserClub: async (userId, clubId, input) =>
    prisma.$transaction(async (transaction) => {
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
          currentMilestoneId: true
        }
      });

      const fromMode = (existingProgress?.mode ?? "STRICT") as ProgressMode;
      const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
      const hasChanged =
        fromMode !== input.mode ||
        fromMilestoneId !== input.currentMilestoneId;

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
          mode: input.mode
        },
        update: {
          currentMilestoneId: input.currentMilestoneId,
          mode: input.mode
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
            toMode: input.mode
          },
          select: {
            id: true
          }
        });

        await enqueueProgressUnlockedNotificationJob(
          progressHistory.id,
          transaction
        );
      }

      const [progress, totalMilestones, history] = await Promise.all([
        transaction.clubProgress.findUniqueOrThrow({
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
        id: progress.id,
        mode: progress.mode as ProgressMode,
        currentMilestone: progress.currentMilestone,
        totalMilestones,
        history: history.map(toProgressHistoryRecord),
        updatedAt: progress.updatedAt
      };
    }),

  listRecentlyUnlockedPostsForUserClub: async (
    userId,
    clubId,
    { cursor, limit }
  ) => {
    const [latestHistory, totalMilestones, progress] = await prisma.$transaction(
      [
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
      ]
    );
    const currentProgress = {
      mode: (progress?.mode ?? "STRICT") as ProgressMode,
      currentMilestonePosition:
        progress?.currentMilestone?.position ?? null
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
      select: recentlyUnlockedPostSelect
    });
    const pagePosts = posts.slice(0, limit);
    const lastPost = pagePosts[pagePosts.length - 1];
    const reactionMap = await userReactionMapForPostIds(
      pagePosts.map((post) => post.id),
      userId
    );

    return {
      unlock,
      posts: pagePosts.map((post) =>
        toRecentlyUnlockedPostRecord(post, reactionMap)
      ),
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

type SelectedRecentlyUnlockedPost = Prisma.PostGetPayload<{
  select: typeof recentlyUnlockedPostSelect;
}>;

type ReactionMap = Map<
  string,
  Map<PostReactionEmoji, { count: number; reactedByMe: boolean }>
>;

const toRecentlyUnlockedPostRecord = (
  post: SelectedRecentlyUnlockedPost,
  reactionMap: ReactionMap
): ClubPostRecord => {
  const postReactions = reactionMap.get(post.id) ?? new Map();
  const reactions = postReactionEmojis.map((emoji) => ({
    emoji,
    count: postReactions.get(emoji)?.count ?? 0,
    reactedByMe: postReactions.get(emoji)?.reactedByMe ?? false
  }));

  return {
    id: post.id,
    type: post.type as ClubPostRecord["type"],
    status: post.status as ClubPostRecord["status"],
    title: post.title,
    body: post.body,
    author: post.author,
    requiredMilestone: post.requiredMilestone,
    prediction: post.prediction
      ? {
          status: post.prediction.status as NonNullable<
            ClubPostRecord["prediction"]
          >["status"],
          revealMilestone: post.prediction.revealMilestone
        }
      : null,
    commentCount: post._count.comments,
    reactionCount: reactions.reduce(
      (total, reaction) => total + reaction.count,
      0
    ),
    reactions,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
};

const userReactionMapForPostIds = async (
  postIds: string[],
  userId: string
): Promise<ReactionMap> => {
  if (postIds.length === 0) {
    return new Map();
  }

  const groupedReactions = await prisma.postReaction.groupBy({
    by: ["postId", "emoji"],
    where: {
      postId: {
        in: postIds
      }
    },
    _count: {
      _all: true
    }
  });
  const userReactions = await prisma.postReaction.findMany({
    where: {
      postId: {
        in: postIds
      },
      userId
    },
    select: {
      postId: true,
      emoji: true
    }
  });
  const userReactionKeys = new Set(
    userReactions.map((reaction) => `${reaction.postId}:${reaction.emoji}`)
  );

  return groupedReactions.reduce<ReactionMap>((map, reaction) => {
    const postReactionMap = map.get(reaction.postId) ?? new Map();

    postReactionMap.set(reaction.emoji as PostReactionEmoji, {
      count: reaction._count._all,
      reactedByMe: userReactionKeys.has(
        `${reaction.postId}:${reaction.emoji}`
      )
    });
    map.set(reaction.postId, postReactionMap);

    return map;
  }, new Map());
};
