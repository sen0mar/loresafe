import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type {
  ClubFeedTab,
  CreateClubPostRequest,
} from "./posts.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubFeedRecord = {
  id: string;
  visibility: ClubVisibility;
  currentUserRole: ClubMembershipRole | null;
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
  commentCount: number;
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
    slug: string;
  };
};

export type PostsRepository = {
  findClubForFeed: (
    slug: string,
    userId: string
  ) => Promise<ClubFeedRecord | null>;
  findClubForPostCreation: (
    slug: string,
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
};

const postSelect = {
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
  findClubForFeed: async (slug, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        slug
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
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition:
          progress?.currentMilestone?.position ?? null
      }
    };
  },

  findClubForPostCreation: async (slug, userId) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        slug
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
      const requiredMilestone = await transaction.milestone.findFirst({
        where: {
          id: input.requiredMilestoneId,
          clubId
        },
        select: {
          id: true
        }
      });

      if (!requiredMilestone) {
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
          status: "VISIBLE"
        },
        select: postSelect
      });

      return {
        ...post,
        type: post.type as ClubPostRecord["type"],
        status: post.status as ClubPostRecord["status"],
        commentCount: 0
      };
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

    return {
      posts: pagePosts.map((post) => ({
        ...post,
        type: post.type as ClubPostRecord["type"],
        status: post.status as ClubPostRecord["status"],
        commentCount: post._count.comments
      })),
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
            slug: true,
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
      post: {
        id: post.id,
        type: post.type as ClubPostRecord["type"],
        status: post.status as ClubPostRecord["status"],
        title: post.title,
        body: post.body,
        author: post.author,
        requiredMilestone: post.requiredMilestone,
        commentCount: post._count.comments,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      },
      club: {
        id: post.club.id,
        slug: post.club.slug,
        visibility: post.club.visibility,
        currentUserRole: post.club.memberships[0]?.role ?? null,
        progress: {
          mode: (progress?.mode ?? "STRICT") as ProgressMode,
          currentMilestonePosition:
            progress?.currentMilestone?.position ?? null
        }
      }
    };
  }
};
