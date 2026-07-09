import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type {
  ClubFeedTab,
  CreateClubPostRequest,
  PostReactionEmoji,
  TogglePostReactionRequest
} from "./posts.schema.js";
import { postReactionEmojis } from "./posts.schema.js";
import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import { canDeletePost, canViewClubFeed } from "./posts.policy.js";
import { lockClubAuthorization } from "../clubs/club-authorization-lock.js";
import { lockPostForWriteAuthorization } from "../spoilers/content-authorization-lock.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";
type PredictionStatus = "UNRESOLVED" | "CORRECT" | "WRONG" | "PARTIAL";

export type ClubFeedRecord = {
  id: string;
  visibility: ClubVisibility;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
  progress: {
    mode: ProgressMode;
    currentMilestonePosition: number | null;
  };
};

export type ClubPostCreationClubRecord = ClubFeedRecord & {
  isCurrentUserBanned: boolean;
};

export type ClubPostRecord = {
  id: string;
  type:
    | "DISCUSSION"
    | "QUESTION"
    | "THEORY"
    | "PREDICTION"
    | "POLL"
    | "REACTION"
    | "REVIEW"
    | "IMAGE_MEME"
    | "QUOTE_COMMENTARY"
    | "JUST_REACHED";
  status: "VISIBLE" | "HIDDEN";
  title: string;
  body: string;
  author: {
    id: string;
    displayName: string;
    username: string | null;
  };
  requiredMilestone: {
    id: string;
    position: number;
    safeTitle: string;
  };
  prediction: {
    status: PredictionStatus;
    revealMilestone: {
      id: string;
      position: number;
      safeTitle: string;
    };
  } | null;
  media: {
    id: string;
    contentType: string;
    sizeBytes: number;
    safePreview: boolean;
    objectKey: string;
  } | null;
  commentCount: number;
  reactionCount: number;
  reactions: Array<{
    emoji: PostReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export type ListClubPostsResult = {
  posts: ClubPostRecord[];
  nextCursor: ClubPostsCursor | null;
  hasMore: boolean;
};

export type ClubPostsCursor = {
  createdAt: Date;
  id: string;
};

export type ListClubPostsInput = {
  tab: ClubFeedTab;
  cursor: ClubPostsCursor | null;
  limit: number;
  authorId: string;
  mode: ProgressMode;
  currentMilestonePosition: number | null;
};

export type PostDetailRecord = {
  post: ClubPostRecord;
  club: ClubFeedRecord & {
    linkName: string;
  };
};

export type DeletePostInput = {
  actorId: string;
  clubId: string;
  postId: string;
  targetUserId: string;
};

export type DeletePostResult = {
  id: string;
  deletedAt: Date;
};

export type PostsRepository = {
  findClubForFeed: (
    linkName: string,
    userId: string
  ) => Promise<ClubFeedRecord | null>;
  findClubForPostCreation: (
    linkName: string,
    userId: string
  ) => Promise<ClubPostCreationClubRecord | null>;
  createClubPost: (
    clubId: string,
    authorId: string,
    input: CreateClubPostRequest
  ) => Promise<ClubPostRecord | null>;
  listClubPosts: (
    clubId: string,
    input: ListClubPostsInput
  ) => Promise<ListClubPostsResult>;
  findPostForDetail: (
    postId: string,
    userId: string
  ) => Promise<PostDetailRecord | null>;
  togglePostReaction: (
    postId: string,
    userId: string,
    input: TogglePostReactionRequest
  ) => Promise<PostDetailRecord | null>;
  softDeletePost: (input: DeletePostInput) => Promise<DeletePostResult | null>;
};

export const postSelect = {
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
  mediaAssets: {
    where: {
      purpose: "POST_IMAGE",
      visibility: "PRIVATE",
      status: "READY"
    },
    select: {
      id: true,
      contentType: true,
      sizeBytes: true,
      safePreview: true,
      objectKey: true
    },
    take: 1
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

export const postsRepository: PostsRepository = {
  findClubForFeed: async (linkName, userId) => {
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
      }
    });

    if (!club) {
      return null;
    }

    const progress = club.progress[0];

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: club.memberships[0]?.role ?? null,
      isCurrentUserBanned: club.bans.length > 0,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition:
          progress?.currentMilestone?.position ?? null
      }
    };
  },

  findClubForPostCreation: async (linkName, userId) => {
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
          where: {
            userId,
            revokedAt: null,
            OR: [
              {
                expiresAt: null
              },
              {
                expiresAt: {
                  gt: now
                }
              }
            ]
          },
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
      }
    });

    if (!club) {
      return null;
    }

    const progress = club.progress[0];

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: club.memberships[0]?.role ?? null,
      isCurrentUserBanned: club.bans.length > 0,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition:
          progress?.currentMilestone?.position ?? null
      }
    };
  },

  createClubPost: async (clubId, authorId, input) =>
    prisma.$transaction(async (transaction) => {
      if (!(await lockClubAuthorization(transaction, clubId))) {
        return null;
      }

      const now = new Date();
      const clubAccess = await transaction.club.findUnique({
        where: {
          id: clubId
        },
        select: {
          memberships: {
            where: {
              userId: authorId
            },
            select: {
              id: true
            },
            take: 1
          },
          bans: {
            where: activeUserBanWhere(authorId, now),
            select: {
              id: true
            },
            take: 1
          }
        }
      });

      if (!clubAccess?.memberships.length || clubAccess.bans.length > 0) {
        return null;
      }

      const requiredMilestone = await transaction.milestone.findFirst({
        where: {
          id: input.requiredMilestoneId,
          clubId
        },
        select: {
          id: true,
          position: true
        }
      });

      if (!requiredMilestone) {
        return null;
      }

      const revealMilestone = input.prediction
        ? await transaction.milestone.findFirst({
            where: {
              id: input.prediction.revealMilestoneId,
              clubId
            },
            select: {
              id: true,
              position: true
            }
          })
        : null;

      if (
        input.type === "PREDICTION" &&
        (!revealMilestone ||
          revealMilestone.position < requiredMilestone.position)
      ) {
        return null;
      }

      const mediaAsset = input.mediaAssetId
        ? await transaction.fileAsset.findFirst({
            where: {
              id: input.mediaAssetId,
              ownerId: authorId,
              clubId,
              postId: null,
              commentId: null,
              purpose: "POST_IMAGE",
              visibility: "PRIVATE",
              status: "READY"
            },
            select: {
              id: true
            }
          })
        : null;

      if (input.mediaAssetId && !mediaAsset) {
        return null;
      }

      const post = await transaction.post.create({
        data: {
          clubId,
          authorId,
          type: input.type,
          title: input.title,
          body: input.body,
          requiredMilestoneId: requiredMilestone.id,
          status: "VISIBLE",
          ...(input.type === "PREDICTION" && revealMilestone
            ? {
                prediction: {
                  create: {
                    revealMilestoneId: revealMilestone.id
                  }
                }
              }
            : {})
        },
        select: postSelect
      });

      if (mediaAsset) {
        await transaction.fileAsset.update({
          where: {
            id: mediaAsset.id
          },
          data: {
            postId: post.id
          },
          select: {
            id: true
          }
        });
      }

      const postWithMedia = await transaction.post.findUniqueOrThrow({
        where: {
          id: post.id
        },
        select: postSelect
      });

      return toClubPostRecord(
        postWithMedia,
        await userReactionMapForPostIds([postWithMedia.id], authorId)
      );
    }),

  listClubPosts: async (
    clubId,
    { authorId, cursor, currentMilestonePosition, limit, mode, tab }
  ) => {
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
    const progressPosition = currentMilestonePosition ?? 0;
    const tabWhere: Prisma.PostWhereInput =
      tab === "safe"
        ? mode === "FINISHED"
          ? {}
          : {
              requiredMilestone: {
                position: {
                  lte: progressPosition
                }
              }
            }
        : tab === "locked"
          ? mode === "FINISHED"
            ? {
                id: {
                  equals: "00000000-0000-0000-0000-000000000000"
                }
              }
            : {
                requiredMilestone: {
                  position: {
                    gt: progressPosition
                  }
                }
              }
          : tab === "unanswered"
            ? {
                comments: {
                  none: {
                    status: "VISIBLE",
                    deletedAt: null
                  }
                }
              }
          : tab === "my-posts"
            ? {
                authorId
              }
            : {};
    const posts = await prisma.post.findMany({
      where: {
        clubId,
        status: "VISIBLE",
        deletedAt: null,
        ...tabWhere,
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
      authorId
    );

    return {
      posts: pagePosts.map((post) => toClubPostRecord(post, reactionMap)),
      nextCursor:
        posts.length > limit && lastPost
          ? {
              createdAt: lastPost.createdAt,
              id: lastPost.id
            }
          : null,
      hasMore: posts.length > limit
    };
  },

  findPostForDetail: async (postId, userId) => {
    const now = new Date();
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "VISIBLE",
        deletedAt: null
      },
      select: {
        ...postSelect,
        club: {
          select: {
            id: true,
            linkName: true,
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
            },
            bans: {
              where: activeUserBanWhere(userId, now),
              select: {
                id: true
              },
              take: 1
            }
          }
        }
      }
    });

    if (!post) {
      return null;
    }

    const progress = post.club.progress[0];

    return {
      post: toClubPostRecord(
        post,
        await userReactionMapForPostIds([post.id], userId)
      ),
      club: {
        id: post.club.id,
        linkName: post.club.linkName,
        visibility: post.club.visibility,
        currentUserRole: post.club.memberships[0]?.role ?? null,
        isCurrentUserBanned: post.club.bans.length > 0,
        progress: {
          mode: (progress?.mode ?? "STRICT") as ProgressMode,
          currentMilestonePosition:
            progress?.currentMilestone?.position ?? null
        }
      }
    };
  },

  togglePostReaction: async (postId, userId, input) => {
    const wasAuthorized = await prisma.$transaction(async (transaction) => {
      const target = await transaction.post.findFirst({
        where: {
          id: postId,
          status: "VISIBLE",
          deletedAt: null
        },
        select: {
          clubId: true
        }
      });

      if (!target || !(await lockClubAuthorization(transaction, target.clubId))) {
        return false;
      }

      if (!(await lockPostForWriteAuthorization(transaction, postId))) {
        return false;
      }

      const now = new Date();
      const authorizedPost = await transaction.post.findFirst({
        where: {
          id: postId,
          clubId: target.clubId,
          status: "VISIBLE",
          deletedAt: null
        },
        select: {
          requiredMilestone: {
            select: {
              position: true
            }
          },
          club: {
            select: {
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
            }
          }
        }
      });

      const progress = authorizedPost?.club.progress[0];
      const access = authorizedPost
        ? {
            id: target.clubId,
            visibility: authorizedPost.club.visibility,
            currentUserRole: authorizedPost.club.memberships[0]?.role ?? null,
            isCurrentUserBanned: authorizedPost.club.bans.length > 0,
            progress: {
              mode: (progress?.mode ?? "STRICT") as ProgressMode,
              currentMilestonePosition:
                progress?.currentMilestone?.position ?? null
            }
          }
        : null;

      if (
        !access ||
        access.isCurrentUserBanned ||
        !canViewClubFeed(access) ||
        !canViewRequiredMilestone({
          mode: access.progress.mode,
          currentMilestonePosition: access.progress.currentMilestonePosition,
          requiredMilestonePosition:
            authorizedPost?.requiredMilestone.position ??
            Number.MAX_SAFE_INTEGER
        })
      ) {
        return false;
      }

      const deletedReaction = await transaction.postReaction.deleteMany({
        where: {
          userId,
          postId,
          emoji: input.emoji
        }
      });

      if (deletedReaction.count > 0) {
        return true;
      }

      try {
        await transaction.postReaction.create({
          data: {
            postId,
            userId,
            emoji: input.emoji
          }
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return true;
        }

        throw error;
      }

      return true;
    });

    if (!wasAuthorized) {
      return null;
    }

    return postsRepository.findPostForDetail(postId, userId);
  },

  softDeletePost: async ({ actorId, clubId, postId, targetUserId }) =>
    prisma.$transaction(async (transaction) => {
      if (!(await lockClubAuthorization(transaction, clubId))) {
        return null;
      }

      if (!(await lockPostForWriteAuthorization(transaction, postId))) {
        return null;
      }

      const now = new Date();
      const authorizedPost = await transaction.post.findFirst({
        where: {
          id: postId,
          clubId,
          status: "VISIBLE",
          deletedAt: null
        },
        select: {
          authorId: true,
          club: {
            select: {
              visibility: true,
              memberships: {
                where: {
                  userId: actorId
                },
                select: {
                  role: true
                },
                take: 1
              },
              bans: {
                where: activeUserBanWhere(actorId, now),
                select: {
                  id: true
                },
                take: 1
              }
            }
          }
        }
      });
      const currentUserRole = authorizedPost?.club.memberships[0]?.role ?? null;

      if (
        !authorizedPost ||
        authorizedPost.club.bans.length > 0 ||
        !canViewClubFeed({
          visibility: authorizedPost.club.visibility,
          currentUserRole,
          isCurrentUserBanned: false
        }) ||
        !canDeletePost({
          authorId: authorizedPost.authorId,
          currentUserId: actorId,
          currentUserRole
        })
      ) {
        return null;
      }

      const deletedAt = new Date();
      const updateResult = await transaction.post.updateMany({
        where: {
          id: postId,
          status: "VISIBLE",
          deletedAt: null
        },
        data: {
          deletedAt
        }
      });

      if (updateResult.count === 0) {
        return null;
      }

      await transaction.auditLog.create({
        data: {
          action: "POST_DELETED",
          actorId,
          clubId,
          postId,
          targetUserId,
          metadata: {
            previousDeletedAt: null,
            deletedAt: deletedAt.toISOString(),
            source: "DIRECT_DELETE"
          }
        },
        select: {
          id: true
        }
      });

      return {
        id: postId,
        deletedAt
      };
    })
};

const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as Prisma.PrismaClientKnownRequestError).code === "P2002";

export type SelectedPost = Prisma.PostGetPayload<{
  select: typeof postSelect;
}>;

export type ReactionMap = Map<
  string,
  Map<PostReactionEmoji, { count: number; reactedByMe: boolean }>
>;

export const toClubPostRecord = (
  post: SelectedPost,
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
          status: post.prediction.status as PredictionStatus,
          revealMilestone: post.prediction.revealMilestone
        }
      : null,
    media: post.mediaAssets[0] ?? null,
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

export const userReactionMapForPostIds = async (
  postIds: string[],
  userId: string
): Promise<ReactionMap> => {
  const reactionMap: ReactionMap = new Map();

  for (const postId of postIds) {
    reactionMap.set(postId, new Map());
  }

  if (postIds.length === 0) {
    return reactionMap;
  }

  const [reactionCounts, currentUserReactions] = await Promise.all([
    prisma.postReaction.groupBy({
      by: ["postId", "emoji"],
      where: {
        postId: {
          in: postIds
        }
      },
      _count: {
        _all: true
      }
    }),
    prisma.postReaction.findMany({
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
    })
  ]);

  for (const reactionCount of reactionCounts) {
    if (!isPostReactionEmoji(reactionCount.emoji)) {
      continue;
    }

    const reactionsForPost =
      reactionMap.get(reactionCount.postId) ?? new Map();

    reactionsForPost.set(reactionCount.emoji, {
      count: reactionCount._count._all,
      reactedByMe: false
    });
    reactionMap.set(reactionCount.postId, reactionsForPost);
  }

  for (const reaction of currentUserReactions) {
    if (!isPostReactionEmoji(reaction.emoji)) {
      continue;
    }

    const reactionsForPost = reactionMap.get(reaction.postId) ?? new Map();
    const aggregate = reactionsForPost.get(reaction.emoji) ?? {
      count: 0,
      reactedByMe: false
    };

    reactionsForPost.set(reaction.emoji, {
      ...aggregate,
      reactedByMe: true
    });
    reactionMap.set(reaction.postId, reactionsForPost);
  }

  return reactionMap;
};

const isPostReactionEmoji = (emoji: string): emoji is PostReactionEmoji =>
  postReactionEmojis.some((allowedEmoji) => allowedEmoji === emoji);
