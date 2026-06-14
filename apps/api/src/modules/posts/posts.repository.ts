import { prisma } from "../../core/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { ListClubPostsQuery } from "./posts.schema.js";

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

export type PostsRepository = {
  findClubForFeed: (
    slug: string,
    userId: string
  ) => Promise<ClubFeedRecord | null>;
  listClubPosts: (
    clubId: string,
    query: ListClubPostsQuery
  ) => Promise<ListClubPostsResult>;
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
  }
};
