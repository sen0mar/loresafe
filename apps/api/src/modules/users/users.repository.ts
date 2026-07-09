import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { enqueueStorageObjectDeleteJob } from "../../jobs/notification-job-queue.js";
import { requestStorageObjectDeletion } from "../../core/storage/storage-deletion.repository.js";
import type { AuthUserRecord } from "../auth/auth.repository.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import type { ClubCategory } from "../clubs/clubs.schema.js";
import type { ListCurrentUserClubsQuery } from "./users.schema.js";
import { lockClubAuthorizationChanges } from "../clubs/club-authorization-lock.js";

export type UpdateCurrentUserProfileInput = {
  displayName?: string;
  bio?: string | null;
};

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type JoinedClubRecord = {
  id: string;
  title: string;
  linkName: string;
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

export type DeleteCurrentUserAccountResult =
  | "DELETED"
  | "SOLE_OWNER"
  | "USER_NOT_FOUND";

export type UsersRepository = {
  deleteCurrentUserAccount: (
    userId: string
  ) => Promise<DeleteCurrentUserAccountResult>;
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
  deleteCurrentUserAccount: (userId) =>
    prisma.$transaction(async (transaction) => {
      const currentUsers = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "users"
        WHERE "id" = ${userId}::uuid
          AND "deleted_at" IS NULL
        FOR UPDATE
      `;
      const currentUser = currentUsers[0] ?? null;

      if (!currentUser) {
        return "USER_NOT_FOUND";
      }

      const memberships = await transaction.clubMembership.findMany({
        where: {
          userId
        },
        orderBy: {
          clubId: "asc"
        },
        select: {
          clubId: true
        }
      });

      for (const membership of memberships) {
        await lockClubAuthorizationChanges(transaction, membership.clubId);
      }

      const soleOwnerMembership = await transaction.clubMembership.findFirst({
        where: {
          userId,
          role: "OWNER",
          club: {
            memberships: {
              none: {
                role: "OWNER",
                userId: {
                  not: userId
                }
              }
            }
          }
        },
        select: {
          id: true
        }
      });

      if (soleOwnerMembership) {
        return "SOLE_OWNER";
      }

      const ownedFileAssets = await transaction.fileAsset.findMany({
        where: {
          ownerId: userId
        },
        select: {
          objectKey: true
        }
      });
      const deletionIds: string[] = [];

      for (const asset of ownedFileAssets) {
        const deletion = await requestStorageObjectDeletion(
          transaction,
          asset.objectKey,
          "ACCOUNT_DELETION"
        );

        if (deletion.status === "PENDING") {
          deletionIds.push(deletion.id);
        }
      }

      await transaction.comment.updateMany({
        where: {
          authorId: {
            not: userId
          },
          parent: {
            is: {
              authorId: userId
            }
          }
        },
        data: {
          parentId: null
        }
      });

      if (deletionIds.length > 0) {
        await enqueueStorageObjectDeleteJob(deletionIds, transaction);
      }

      await transaction.user.delete({
        where: {
          id: userId
        }
      });

      return "DELETED";
    }),

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

  listJoinedClubsForUser: async (userId, { page, limit, q }) => {
    const skip = (page - 1) * limit;
    const now = new Date();
    const clubSearchWhere = buildJoinedClubSearchWhere(q);
    const roleSearchWhere = buildJoinedClubRoleSearchWhere(q);
    const searchOr = [
      ...(clubSearchWhere ? [{ club: clubSearchWhere }] : []),
      ...(roleSearchWhere ? [{ role: roleSearchWhere }] : [])
    ];
    const membershipWhere = {
      userId,
      club: {
        bans: {
          none: activeUserBanWhere(userId, now)
        }
      },
      ...(searchOr.length > 0
        ? {
            OR: searchOr
          }
        : {})
    } satisfies Prisma.ClubMembershipWhereInput;

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
              linkName: true,
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
        linkName: membership.club.linkName,
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

const joinedClubCategoryLabels = {
  BOOKS: "books",
  TV_SHOWS: "tv shows television shows",
  ANIME: "anime",
  MANGA: "manga",
  MOVIES: "movies films",
  GAMES: "games",
  PODCASTS: "podcasts",
  COURSES: "courses",
  COMICS_GRAPHIC_NOVELS: "comics graphic novels",
  WEB_SERIALS: "web serials",
  CUSTOM_TIMELINE: "custom timeline"
} satisfies Record<ClubCategory, string>;

const joinedClubVisibilityLabels = {
  PUBLIC: "public",
  PRIVATE: "private",
  INVITE_ONLY: "invite only invite-only"
} satisfies Record<ClubVisibility, string>;

const joinedClubRoleLabels = {
  OWNER: "owner",
  MODERATOR: "moderator mod",
  MEMBER: "member"
} satisfies Record<ClubMembershipRole, string>;

const buildJoinedClubSearchWhere = (
  searchQuery: string
): Prisma.ClubWhereInput | undefined => {
  const normalizedQuery = normalizeSearchText(searchQuery);

  if (!normalizedQuery) {
    return undefined;
  }

  const categoryMatches = (
    Object.keys(joinedClubCategoryLabels) as ClubCategory[]
  ).filter((category) =>
    joinedClubCategoryLabels[category].includes(normalizedQuery)
  );
  const visibilityMatches = (
    Object.keys(joinedClubVisibilityLabels) as ClubVisibility[]
  ).filter((visibility) =>
    joinedClubVisibilityLabels[visibility].includes(normalizedQuery)
  );

  return {
    OR: [
      {
        title: {
          contains: searchQuery,
          mode: "insensitive"
        }
      },
      {
        linkName: {
          contains: normalizedQuery.replaceAll(" ", "-"),
          mode: "insensitive"
        }
      },
      ...(categoryMatches.length > 0
        ? [
            {
              category: {
                in: categoryMatches
              }
            }
          ]
        : []),
      ...(visibilityMatches.length > 0
        ? [
            {
              visibility: {
                in: visibilityMatches
              }
            }
          ]
        : [])
    ]
  };
};

const buildJoinedClubRoleSearchWhere = (
  searchQuery: string
): Prisma.EnumClubMembershipRoleFilter | undefined => {
  const normalizedQuery = normalizeSearchText(searchQuery);

  if (!normalizedQuery) {
    return undefined;
  }

  const roleMatches = (
    Object.keys(joinedClubRoleLabels) as ClubMembershipRole[]
  ).filter((role) => joinedClubRoleLabels[role].includes(normalizedQuery));

  return roleMatches.length > 0
    ? {
        in: roleMatches
      }
    : undefined;
};

const normalizeSearchText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");
