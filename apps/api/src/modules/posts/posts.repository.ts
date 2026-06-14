import { prisma } from "../../core/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type {
  CreateClubPostRequest,
  ListClubPostsQuery
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
  createdAt: Date;
  updatedAt: Date;
};

export type ListClubPostsResult = {
  posts: ClubPostRecord[];
  total: number;
};

export type PostDetailRecord = {
  post: ClubPostRecord;
  club: ClubFeedRecord;
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
    query: ListClubPostsQuery
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
        status: post.status as ClubPostRecord["status"]
      };
    }),

  listClubPosts: async (clubId, { page, limit }) => {
    const skip = (page - 1) * limit;
    const where = {
      clubId,
      status: "VISIBLE" as const,
      deletedAt: null
    };
    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        orderBy: [
          {
            createdAt: "desc"
          },
          {
            id: "asc"
          }
        ],
        skip,
        take: limit,
        select: postSelect
      }),
      prisma.post.count({
        where
      })
    ]);

    return {
      posts: posts.map((post) => ({
        ...post,
        type: post.type as ClubPostRecord["type"],
        status: post.status as ClubPostRecord["status"]
      })),
      total
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
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      },
      club: {
        id: post.club.id,
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
