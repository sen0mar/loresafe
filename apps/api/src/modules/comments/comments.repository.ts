import { prisma } from "../../core/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import {
  commentReactionEmojis,
  type CommentReactionEmoji,
  type CreatePostCommentRequest,
  type ToggleCommentReactionRequest
} from "./comments.schema.js";
import { createNotificationInTransaction } from "../notifications/notifications.repository.js";
import type { NotificationType } from "../notifications/notifications.schema.js";

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
  notification?: {
    userId: string;
    type: NotificationType;
    safeText: string;
    clubId: string;
  };
};

export type CommentReactionTargetRecord = {
  comment: CommentRecord;
  post: CommentPostRecord;
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
    userId: string
  ) => Promise<CommentRecord[]>;
  findVisibleCommentForReaction: (
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

  listVisibleCommentsForPost: async (postId, userId) => {
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        status: "VISIBLE",
        deletedAt: null
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ],
      take: 100,
      select: commentSelect
    });

    const reactionMap = await userReactionMapForCommentIds(
      comments.map((comment) => comment.id),
      userId
    );

    return comments.map((comment) => toCommentRecord(comment, reactionMap));
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

  createPostComment: async (postId, authorId, input) =>
    prisma.$transaction(async (transaction) => {
      if (input.parentId) {
        const parent = await transaction.comment.findFirst({
          where: {
            id: input.parentId,
            postId,
            status: "VISIBLE",
            deletedAt: null
          },
          select: {
            id: true,
            parentId: true
          }
        });

        if (!parent || parent.parentId !== null) {
          return null;
        }
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

      if (input.notification) {
        await createNotificationInTransaction(transaction, {
          userId: input.notification.userId,
          type: input.notification.type,
          safeText: input.notification.safeText,
          clubId: input.notification.clubId,
          postId,
          commentId: comment.id,
          requiredMilestoneId: input.requiredMilestoneId
        });
      }

      return toCommentRecord(comment);
    }),

  toggleCommentReaction: async (commentId, userId, input) => {
    await prisma.$transaction(async (transaction) => {
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
        return;
      }

      await transaction.commentReaction.create({
        data: {
          commentId,
          userId,
          emoji: input.emoji
        }
      });
    });

    return commentsRepository.findVisibleCommentForReaction(commentId, userId);
  }
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
