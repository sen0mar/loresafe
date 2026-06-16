import { prisma } from "../../core/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { CreatePostCommentRequest } from "./comments.schema.js";

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
  requiredMilestone: CommentMilestoneRecord;
  club: {
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
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePostCommentInput = CreatePostCommentRequest & {
  requiredMilestoneId: string;
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
  listVisibleCommentsForPost: (postId: string) => Promise<CommentRecord[]>;
  createPostComment: (
    postId: string,
    authorId: string,
    input: CreatePostCommentInput
  ) => Promise<CommentRecord | null>;
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

const toCommentRecord = (comment: {
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
}): CommentRecord => ({
  ...comment,
  status: comment.status as CommentRecord["status"]
});

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

    const progress = post.club.progress[0];

    return {
      id: post.id,
      clubId: post.clubId,
      requiredMilestone: post.requiredMilestone,
      club: {
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

  listVisibleCommentsForPost: async (postId) => {
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

    return comments.map(toCommentRecord);
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

      return toCommentRecord(comment);
    })
};
