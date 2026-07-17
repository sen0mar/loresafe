import { prisma } from "../../core/prisma/client.js";
import type { TimestampUuidCursor } from "../../core/http/cursor.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { requestStorageObjectDeletion } from "../../core/storage/storage-deletion.repository.js";
import type { AuthUserRecord } from "../auth/auth.repository.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import type { ClubCategory } from "../clubs/clubs.schema.js";
import type { ListCurrentUserClubsQuery } from "./users.schema.js";
import { lockClubAuthorizationChanges } from "../clubs/club-authorization-lock.js";
import {
  activeUserSelect,
  findActiveUserByReservedName
} from "../../core/identity/active-user.js";

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
  coverAsset?:
    | {
        objectKey: string;
        status: "PENDING" | "READY" | "FAILED";
      }
    | null
    | undefined;
  visibility: ClubVisibility;
  role: ClubMembershipRole;
  memberCount: number;
  joinedAt: Date;
};

export type ListJoinedClubsResult = {
  clubs: JoinedClubRecord[];
  hasMore: boolean;
  nextCursor: TimestampUuidCursor | null;
};

export type ListJoinedClubsInput = Omit<ListCurrentUserClubsQuery, "cursor"> & {
  cursor: TimestampUuidCursor | null;
};

export type DeleteCurrentUserAccountResult =
  | { status: "DELETED"; deletionIds: string[] }
  | "REAUTH_REQUIRED"
  | "SOLE_OWNER"
  | "USER_NOT_FOUND";

export type CurrentUserCredentialsRecord = {
  passwordHash: string;
  sessionVersion: number;
};

export type UsersRepository = {
  deleteCurrentUserAccount: (
    userId: string,
    expectedSessionVersion: number
  ) => Promise<DeleteCurrentUserAccountResult>;
  findActiveUserCredentialsById: (
    userId: string
  ) => Promise<CurrentUserCredentialsRecord | null>;
  findActiveUserByReservedName: (
    normalizedName: string
  ) => Promise<AuthUserRecord | null>;
  listJoinedClubsForUser: (
    userId: string,
    query: ListJoinedClubsInput
  ) => Promise<ListJoinedClubsResult>;
  updateActiveUserProfile: (
    userId: string,
    input: UpdateCurrentUserProfileInput
  ) => Promise<AuthUserRecord | null>;
};

export const usersRepository: UsersRepository = {
  deleteCurrentUserAccount: (userId, expectedSessionVersion) =>
    prisma.$transaction(async (transaction) => {
      const currentUsers = await transaction.$queryRaw<
        Array<{ id: string; session_version: number }>
      >`
        SELECT "id", "session_version"
        FROM "users"
        WHERE "id" = ${userId}::uuid
          AND "deleted_at" IS NULL
        FOR UPDATE
      `;
      const currentUser = currentUsers[0] ?? null;

      if (!currentUser) {
        return "USER_NOT_FOUND";
      }

      if (currentUser.session_version !== expectedSessionVersion) {
        return "REAUTH_REQUIRED";
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

      await transaction.user.update({
        where: {
          id: userId
        },
        data: {
          sessionVersion: {
            increment: 1
          }
        },
        select: {
          id: true
        }
      });

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

      await transaction.user.delete({
        where: {
          id: userId
        }
      });

      return {
        status: "DELETED",
        deletionIds
      };
    }),

  findActiveUserCredentialsById: (userId) =>
    prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: {
        passwordHash: true,
        sessionVersion: true
      }
    }),

  findActiveUserByReservedName,

  listJoinedClubsForUser: async (userId, { cursor, limit, q }) => {
    const now = new Date();
    const clubSearchWhere = buildJoinedClubSearchWhere(q);
    const roleSearchWhere = buildJoinedClubRoleSearchWhere(q);
    const searchOr = [
      ...(clubSearchWhere ? [{ club: clubSearchWhere }] : []),
      ...(roleSearchWhere ? [{ role: roleSearchWhere }] : [])
    ];
    const baseMembershipWhere = {
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
    const cursorWhere: Prisma.ClubMembershipWhereInput = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } }
          ]
        }
      : {};
    const membershipWhere: Prisma.ClubMembershipWhereInput = {
      AND: [baseMembershipWhere, cursorWhere]
    };

    const memberships = await prisma.clubMembership.findMany({
      where: membershipWhere,
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "asc"
        }
      ],
      take: limit + 1,
      select: {
        id: true,
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
    });
    const hasMore = memberships.length > limit;
    const pageMemberships = memberships.slice(0, limit);
    const lastMembership = pageMemberships.at(-1);

    return {
      clubs: pageMemberships.map((membership) => ({
        id: membership.club.id,
        title: membership.club.title,
        linkName: membership.club.linkName,
        coverAsset: membership.club.coverAsset,
        visibility: membership.club.visibility,
        role: membership.role,
        memberCount: membership.club._count.memberships,
        joinedAt: membership.createdAt
      })),
      hasMore,
      nextCursor:
        hasMore && lastMembership
          ? { createdAt: lastMembership.createdAt, id: lastMembership.id }
          : null
    };
  },

  updateActiveUserProfile: async (userId, input) =>
    prisma.$transaction(async (transaction) => {
      const currentUser = await transaction.user.findFirst({
        where: {
          id: userId,
          deletedAt: null
        },
        select: activeUserSelect
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

        const nextDisplayNameKey = normalizeNameReservationKey(
          input.displayName
        );
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
        select: activeUserSelect
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
  value.trim().toLowerCase().replaceAll("-", " ").replace(/\s+/g, " ");
