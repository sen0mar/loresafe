import { prisma } from "../../core/prisma/client.js";
import type { AuthUserRecord } from "../auth/auth.repository.js";
import type { ListCurrentUserClubsQuery } from "./users.schema.js";

export type UpdateCurrentUserProfileInput = {
  displayName?: string;
  username?: string;
  bio?: string | null;
};

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type JoinedClubRecord = {
  id: string;
  title: string;
  slug: string;
  coverAsset?: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null | undefined;
  visibility: ClubVisibility;
  role: ClubMembershipRole;
  memberCount: number;
  joinedAt: Date;
};

export type ListJoinedClubsResult = {
  clubs: JoinedClubRecord[];
  total: number;
};

export type UsersRepository = {
  findActiveUserByUsername: (username: string) => Promise<AuthUserRecord | null>;
  listJoinedClubsForUser: (
    userId: string,
    query: ListCurrentUserClubsQuery
  ) => Promise<ListJoinedClubsResult>;
  updateActiveUserProfile: (
    userId: string,
    input: UpdateCurrentUserProfileInput
  ) => Promise<AuthUserRecord | null>;
};

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  bio: true,
  avatarAsset: {
    select: {
      objectKey: true,
      status: true
    }
  },
  sessionVersion: true,
  createdAt: true,
  updatedAt: true
} as const;

export const usersRepository: UsersRepository = {
  findActiveUserByUsername: (username) =>
    prisma.user.findFirst({
      where: {
        username,
        deletedAt: null
      },
      select: userSelect
    }),

  listJoinedClubsForUser: async (userId, { page, limit }) => {
    const skip = (page - 1) * limit;

    const [memberships, total] = await prisma.$transaction([
      prisma.clubMembership.findMany({
        where: {
          userId
        },
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
        select: {
          role: true,
          createdAt: true,
          club: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverAsset: {
                select: {
                  objectKey: true,
                  status: true
                }
              },
              visibility: true,
              _count: {
                select: {
                  memberships: true
                }
              }
            }
          }
        }
      }),
      prisma.clubMembership.count({
        where: {
          userId
        }
      })
    ]);

    return {
      clubs: memberships.map((membership) => ({
        id: membership.club.id,
        title: membership.club.title,
        slug: membership.club.slug,
        coverAsset: membership.club.coverAsset,
        visibility: membership.club.visibility,
        role: membership.role,
        memberCount: membership.club._count.memberships,
        joinedAt: membership.createdAt
      })),
      total
    };
  },

  updateActiveUserProfile: async (userId, input) => {
    const updateResult = await prisma.user.updateMany({
      where: {
        id: userId,
        deletedAt: null
      },
      data: input
    });

    if (updateResult.count === 0) {
      return null;
    }

    return prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: userSelect
    });
  }
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
