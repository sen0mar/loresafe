import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { enqueueCommentCreatedNotificationJob } from "../../jobs/notification-job-queue.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import { lockClubAuthorization } from "../clubs/club-authorization-lock.js";
import {
  canCreatePostComment,
  canDeleteComment,
  canToggleCommentReaction,
  canViewPostComments
} from "./comments.policy.js";
import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import {
  lockCommentForReadAuthorization,
  lockCommentForWriteAuthorization,
  lockPostForReadAuthorization
} from "../spoilers/content-authorization-lock.js";
import {
  commentReactionEmojis,
  type CommentReactionEmoji,
  type CreatePostCommentRequest,
  type ListPostCommentsQuery,
  type ToggleCommentReactionRequest
} from "./comments.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type CommentMilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
};

export type CommentPostRecord = {
  id: string;
  clubId: string;
  authorId: string;
  requiredMilestone: CommentMilestoneRecord;
  club: {
    title: string;
    visibility: ClubVisibility;
    currentUserRole: ClubMembershipRole | null;
    isCurrentUserBanned: boolean;
    progress: {
      mode: ProgressMode;
      currentMilestonePosition: number | null;
    };
  };
};

export type CommentRecord = {
  id: string;
  postId: string;
  parentId: string | null;
  status: "VISIBLE" | "HIDDEN";
  body: string;
  author: {
    id: string;
    displayName: string;
    username: string | null;
  };
  requiredMilestone: CommentMilestoneRecord;
  reactionCount: number;
  reactions: Array<{
    emoji: CommentReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePostCommentInput = CreatePostCommentRequest & {
  requiredMilestoneId: string;
};

export type CommentsCursor = {
  createdAt: Date;
  id: string;
};

export type ListVisibleCommentsInput = {
  cursor: CommentsCursor | null;
  limit: ListPostCommentsQuery["limit"];
};

export type ListVisibleCommentsResult = {
  comments: CommentRecord[];
  nextCursor: CommentsCursor | null;
  hasMore: boolean;
};

export type CommentReactionTargetRecord = {
  comment: CommentRecord;
  post: CommentPostRecord;
};

export type DeleteCommentInput = {
  actorId: string;
  clubId: string;
  commentId: string;
  postId: string;
  targetUserId: string;
};

export type DeleteCommentResult = {
  id: string;
  postId: string;
  deletedAt: Date;
};

export type CommentsRepository = {
  findPostForComments: (
    postId: string,
    userId: string
  ) => Promise<CommentPostRecord | null>;
  findVisibleCommentForPost: (
    commentId: string,
    postId: string
  ) => Promise<CommentRecord | null>;
  findMilestoneForClub: (
    milestoneId: string,
    clubId: string
  ) => Promise<CommentMilestoneRecord | null>;
  listVisibleCommentsForPost: (
    postId: string,
    userId: string,
    input: ListVisibleCommentsInput
  ) => Promise<ListVisibleCommentsResult>;
  findVisibleCommentForReaction: (
    commentId: string,
    userId: string
  ) => Promise<CommentReactionTargetRecord | null>;
  findVisibleCommentForDeletion: (
    commentId: string,
    userId: string
  ) => Promise<CommentReactionTargetRecord | null>;
  createPostComment: (
    postId: string,
    authorId: string,
    input: CreatePostCommentInput
  ) => Promise<CommentRecord | null>;
  toggleCommentReaction: (
    commentId: string,
    userId: string,
    input: ToggleCommentReactionRequest
  ) => Promise<CommentReactionTargetRecord | null>;
  softDeleteComment: (
    input: DeleteCommentInput
  ) => Promise<DeleteCommentResult | null>;
};

const commentSelect = {
  id: true,
  postId: true,
  parentId: true,
  status: true,
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
  createdAt: true,
  updatedAt: true
} as const;

const toCommentRecord = (
  comment: {
    id: string;
    postId: string;
    parentId: string | null;
    status: "VISIBLE" | "HIDDEN";
    body: string;
    author: {
      id: string;
      displayName: string;
      username: string | null;
    };
    requiredMilestone: CommentMilestoneRecord;
    createdAt: Date;
    updatedAt: Date;
  },
  reactionMap: ReactionMap = new Map()
): CommentRecord => {
  const commentReactions = reactionMap.get(comment.id) ?? new Map();
  const reactions = commentReactionEmojis.map((emoji) => ({
    emoji,
    count: commentReactions.get(emoji)?.count ?? 0,
    reactedByMe: commentReactions.get(emoji)?.reactedByMe ?? false
  }));

  return {
    ...comment,
    status: comment.status as CommentRecord["status"],
    reactionCount: reactions.reduce(
      (total, reaction) => total + reaction.count,
      0
    ),
    reactions
  };
};

const toCommentPostRecord = (post: {
  id: string;
  clubId: string;
  authorId: string;
  requiredMilestone: CommentMilestoneRecord;
  club: {
    title: string;
    visibility: ClubVisibility;
    memberships: Array<{
      role: ClubMembershipRole;
    }>;
    bans: Array<{
      id: string;
    }>;
    progress: Array<{
      mode: ProgressMode;
      currentMilestone: {
        position: number;
      } | null;
    }>;
  };
}): CommentPostRecord => {
  const progress = post.club.progress[0];

  return {
    id: post.id,
    clubId: post.clubId,
    authorId: post.authorId,
    requiredMilestone: post.requiredMilestone,
    club: {
      title: post.club.title,
      visibility: post.club.visibility,
      currentUserRole: post.club.memberships[0]?.role ?? null,
      isCurrentUserBanned: post.club.bans.length > 0,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition: progress?.currentMilestone?.position ?? null
      }
    }
  };
};

export const commentsRepository: CommentsRepository = {
  findPostForComments: async (postId, userId) => {
    const now = new Date();
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "VISIBLE",
        deletedAt: null
      },
      select: {
        id: true,
        clubId: true,
        authorId: true,
        requiredMilestone: {
          select: {
            id: true,
            position: true,
            safeTitle: true
          }
        },
        club: {
          select: {
            visibility: true,
            title: true,
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
        }
      }
    });

    if (!post) {
      return null;
    }

    return toCommentPostRecord(post);
  },

  findVisibleCommentForPost: async (commentId, postId) => {
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        postId,
        status: "VISIBLE",
        deletedAt: null
      },
      select: commentSelect
    });

    return comment ? toCommentRecord(comment) : null;
  },

  findMilestoneForClub: async (milestoneId, clubId) =>
    prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        clubId
      },
      select: {
        id: true,
        position: true,
        safeTitle: true
      }
    }),

  listVisibleCommentsForPost: async (postId, userId, { cursor, limit }) => {
    const cursorWhere = cursor
      ? {
          OR: [
            {
              createdAt: {
                gt: cursor.createdAt
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
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        status: "VISIBLE",
        deletedAt: null,
        ...cursorWhere
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ],
      take: limit + 1,
      select: commentSelect
    });
    const pageComments = comments.slice(0, limit);
    const lastComment = pageComments[pageComments.length - 1];

    const reactionMap = await userReactionMapForCommentIds(
      pageComments.map((comment) => comment.id),
      userId
    );

    return {
      comments: pageComments.map((comment) =>
        toCommentRecord(comment, reactionMap)
      ),
      nextCursor:
        comments.length > limit && lastComment
          ? {
              createdAt: lastComment.createdAt,
              id: lastComment.id
            }
          : null,
      hasMore: comments.length > limit
    };
  },

  findVisibleCommentForReaction: async (commentId, userId) => {
    const now = new Date();
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
        ...commentSelect,
        post: {
          select: {
            id: true,
            clubId: true,
            authorId: true,
            requiredMilestone: {
              select: {
                id: true,
                position: true,
                safeTitle: true
              }
            },
            club: {
              select: {
                visibility: true,
                title: true,
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
            }
          }
        }
      }
    });

    if (!comment) {
      return null;
    }

    const reactionMap = await userReactionMapForCommentIds([comment.id], userId);
    const { post, ...commentRecord } = comment;

    return {
      comment: toCommentRecord(commentRecord, reactionMap),
      post: toCommentPostRecord(post)
    };
  },

  findVisibleCommentForDeletion: async (commentId, userId) =>
    commentsRepository.findVisibleCommentForReaction(commentId, userId),

  createPostComment: async (postId, authorId, input) =>
    prisma.$transaction(async (transaction) => {
      const postTarget = await transaction.post.findFirst({
        where: {
          id: postId,
          status: "VISIBLE",
          deletedAt: null
        },
        select: {
          clubId: true
        }
      });

      if (
        !postTarget ||
        !(await lockClubAuthorization(transaction, postTarget.clubId))
      ) {
        return null;
      }

      if (!(await lockPostForReadAuthorization(transaction, postId))) {
        return null;
      }

      if (
        input.parentId &&
        !(await lockCommentForReadAuthorization(transaction, input.parentId))
      ) {
        return null;
      }

      const post = await findCommentPostForCommand(
        transaction,
        postId,
        authorId
      );
      const selectedMilestone = await transaction.milestone.findFirst({
        where: {
          id: input.requiredMilestoneId,
          clubId: postTarget.clubId
        },
        select: {
          id: true,
          position: true
        }
      });
      const parent = input.parentId
        ? await transaction.comment.findFirst({
          where: {
            id: input.parentId,
            postId,
            status: "VISIBLE",
            deletedAt: null
          },
          select: {
            id: true,
            parentId: true,
            requiredMilestone: {
              select: {
                position: true
              }
            }
          }
        })
        : null;
      const inheritedPosition =
        parent?.requiredMilestone.position ?? post?.requiredMilestone.position;

      if (
        !post ||
        !selectedMilestone ||
        (input.parentId && (!parent || parent.parentId !== null)) ||
        inheritedPosition === undefined ||
        selectedMilestone.position < inheritedPosition ||
        !canViewPostComments(post) ||
        !canCreatePostComment(post, selectedMilestone.position)
      ) {
        return null;
      }

      const comment = await transaction.comment.create({
        data: {
          postId,
          authorId,
          parentId: input.parentId ?? null,
          body: input.body,
          requiredMilestoneId: input.requiredMilestoneId,
          status: "VISIBLE"
        },
        select: commentSelect
      });

      await enqueueCommentCreatedNotificationJob(comment.id, transaction);

      return toCommentRecord(comment);
    }),

  toggleCommentReaction: async (commentId, userId, input) => {
    const wasAuthorized = await prisma.$transaction(async (transaction) => {
      const target = await transaction.comment.findFirst({
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
          post: {
            select: {
              id: true,
              clubId: true
            }
          }
        }
      });

      if (
        !target ||
        !(await lockClubAuthorization(transaction, target.post.clubId))
      ) {
        return false;
      }

      if (
        !(await lockPostForReadAuthorization(transaction, target.post.id)) ||
        !(await lockCommentForWriteAuthorization(transaction, commentId))
      ) {
        return false;
      }

      const post = await findCommentPostForCommand(
        transaction,
        target.post.id,
        userId
      );
      const authorizedComment = await transaction.comment.findFirst({
        where: {
          id: commentId,
          postId: target.post.id,
          status: "VISIBLE",
          deletedAt: null
        },
        select: {
          requiredMilestone: {
            select: {
              position: true
            }
          }
        }
      });

      if (
        !post ||
        !authorizedComment ||
        !canViewPostComments(post) ||
        !canToggleCommentReaction(post) ||
        !canViewRequiredMilestone({
          mode: post.club.progress.mode,
          currentMilestonePosition: post.club.progress.currentMilestonePosition,
          requiredMilestonePosition:
            authorizedComment.requiredMilestone.position
        })
      ) {
        return false;
      }

      const existingReaction = await transaction.commentReaction.findUnique({
        where: {
          userId_commentId_emoji: {
            userId,
            commentId,
            emoji: input.emoji
          }
        },
        select: {
          id: true
        }
      });

      if (existingReaction) {
        await transaction.commentReaction.delete({
          where: {
            id: existingReaction.id
          }
        });
        return true;
      }

      await transaction.commentReaction.create({
        data: {
          commentId,
          userId,
          emoji: input.emoji
        }
      });

      return true;
    });

    if (!wasAuthorized) {
      return null;
    }

    return commentsRepository.findVisibleCommentForReaction(commentId, userId);
  },

  softDeleteComment: async ({
    actorId,
    clubId,
    commentId,
    postId,
    targetUserId
  }) =>
    prisma.$transaction(async (transaction) => {
      if (!(await lockClubAuthorization(transaction, clubId))) {
        return null;
      }

      if (
        !(await lockPostForReadAuthorization(transaction, postId)) ||
        !(await lockCommentForWriteAuthorization(transaction, commentId))
      ) {
        return null;
      }

      const authorizedComment = await transaction.comment.findFirst({
        where: {
          id: commentId,
          postId,
          status: "VISIBLE",
          deletedAt: null,
          post: {
            clubId,
            status: "VISIBLE",
            deletedAt: null
          }
        },
        select: {
          authorId: true
        }
      });
      const post = await findCommentPostForCommand(transaction, postId, actorId);

      if (
        !authorizedComment ||
        !post ||
        !canViewPostComments(post) ||
        !canDeleteComment({
          authorId: authorizedComment.authorId,
          currentUserId: actorId,
          currentUserRole: post.club.currentUserRole
        })
      ) {
        return null;
      }

      const deletedAt = new Date();
      const updateResult = await transaction.comment.updateMany({
        where: {
          id: commentId,
          status: "VISIBLE",
          deletedAt: null,
          post: {
            status: "VISIBLE",
            deletedAt: null
          }
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
          action: "COMMENT_DELETED",
          actorId,
          clubId,
          postId,
          commentId,
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
        id: commentId,
        postId,
        deletedAt
      };
    })
};

const findCommentPostForCommand = async (
  transaction: Prisma.TransactionClient,
  postId: string,
  userId: string
): Promise<CommentPostRecord | null> => {
  const now = new Date();
  const post = await transaction.post.findFirst({
    where: {
      id: postId,
      status: "VISIBLE",
      deletedAt: null
    },
    select: {
      id: true,
      clubId: true,
      authorId: true,
      requiredMilestone: {
        select: {
          id: true,
          position: true,
          safeTitle: true
        }
      },
      club: {
        select: {
          title: true,
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

  return post ? toCommentPostRecord(post) : null;
};

type ReactionMap = Map<
  string,
  Map<CommentReactionEmoji, { count: number; reactedByMe: boolean }>
>;

const userReactionMapForCommentIds = async (
  commentIds: string[],
  userId: string
): Promise<ReactionMap> => {
  const reactionMap: ReactionMap = new Map();

  for (const commentId of commentIds) {
    reactionMap.set(commentId, new Map());
  }

  if (commentIds.length === 0) {
    return reactionMap;
  }

  const [reactionCounts, currentUserReactions] = await Promise.all([
    prisma.commentReaction.groupBy({
      by: ["commentId", "emoji"],
      where: {
        commentId: {
          in: commentIds
        }
      },
      _count: {
        _all: true
      }
    }),
    prisma.commentReaction.findMany({
      where: {
        commentId: {
          in: commentIds
        },
        userId
      },
      select: {
        commentId: true,
        emoji: true
      }
    })
  ]);

  for (const reactionCount of reactionCounts) {
    if (!isCommentReactionEmoji(reactionCount.emoji)) {
      continue;
    }

    const reactionsForComment =
      reactionMap.get(reactionCount.commentId) ?? new Map();

    reactionsForComment.set(reactionCount.emoji, {
      count: reactionCount._count._all,
      reactedByMe: false
    });
    reactionMap.set(reactionCount.commentId, reactionsForComment);
  }

  for (const reaction of currentUserReactions) {
    if (!isCommentReactionEmoji(reaction.emoji)) {
      continue;
    }

    const reactionsForComment =
      reactionMap.get(reaction.commentId) ?? new Map();
    const aggregate = reactionsForComment.get(reaction.emoji) ?? {
      count: 0,
      reactedByMe: false
    };

    reactionsForComment.set(reaction.emoji, {
      ...aggregate,
      reactedByMe: true
    });
    reactionMap.set(reaction.commentId, reactionsForComment);
  }

  return reactionMap;
};

const isCommentReactionEmoji = (
  emoji: string
): emoji is CommentReactionEmoji =>
  commentReactionEmojis.some((allowedEmoji) => allowedEmoji === emoji);
