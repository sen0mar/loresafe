import { prisma } from "../../core/prisma/client.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import type { AuthUserRecord } from "../auth/auth.repository.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import type { ListCurrentUserClubsQuery } from "./users.schema.js";

export type UpdateCurrentUserProfileInput = {
  displayName?: string;
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
  findActiveUserByReservedName: (
    normalizedName: string
  ) => Promise<AuthUserRecord | null>;
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
  findActiveUserByReservedName: async (normalizedName) => {
    const reservation = await prisma.userNameReservation.findFirst({
      where: {
        normalizedName,
        user: {
          deletedAt: null
        }
      },
      select: {
        user: {
          select: userSelect
        }
      }
    });

    return reservation?.user ?? null;
  },

  listJoinedClubsForUser: async (userId, { page, limit }) => {
    const skip = (page - 1) * limit;
    const now = new Date();
    const membershipWhere = {
      userId,
      club: {
        bans: {
          none: activeUserBanWhere(userId, now)
        }
      }
    };

    const [memberships, total] = await prisma.$transaction([
      prisma.clubMembership.findMany({
        where: membershipWhere,
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
        where: membershipWhere
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

  updateActiveUserProfile: async (userId, input) =>
    prisma.$transaction(async (transaction) => {
      const currentUser = await transaction.user.findFirst({
        where: {
          id: userId,
          deletedAt: null
        },
        select: userSelect
      });

      if (!currentUser) {
        return null;
      }

      if (input.displayName !== undefined) {
        const ensureReservation = async (normalizedName: string) => {
          const existingReservation =
            await transaction.userNameReservation.findUnique({
              where: {
                normalizedName
              },
              select: {
                userId: true
              }
            });

          if (!existingReservation || existingReservation.userId !== userId) {
            await transaction.userNameReservation.create({
              data: {
                normalizedName,
                userId
              }
            });
          }
        };

        const nextDisplayNameKey = normalizeNameReservationKey(input.displayName);
        const currentDisplayNameKey = normalizeNameReservationKey(
          currentUser.displayName
        );
        const currentUsernameKey = normalizeNameReservationKey(
          currentUser.username ?? ""
        );

        await ensureReservation(nextDisplayNameKey);

        if (nextDisplayNameKey !== currentDisplayNameKey) {
          if (
            currentDisplayNameKey !== currentUsernameKey &&
            currentDisplayNameKey !== nextDisplayNameKey
          ) {
            await transaction.userNameReservation.deleteMany({
              where: {
                normalizedName: currentDisplayNameKey,
                userId
              }
            });
          }
        }
      }

      await transaction.user.update({
        where: {
          id: userId
        },
        data: input
      });

      return transaction.user.findFirst({
        where: {
          id: userId,
          deletedAt: null
        },
        select: userSelect
      });
    })
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
