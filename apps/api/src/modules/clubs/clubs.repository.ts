import { prisma } from "../../core/prisma/client.js";
import { isUniqueConstraintError } from "../../core/prisma/prisma-errors.js";
import { getBoundedPageOffset } from "../../core/http/pagination.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { createAuditLogInTransaction } from "../audit/audit-log.repository.js";
import type {
  ListClubsQuery,
  ListPublicSeoClubsQuery
} from "./clubs.schema.js";
import {
  activeBanWhere,
  activeUserBanWhere,
  canActorBanTarget,
  canActorUnbanRole
} from "./club-bans.js";
import { softDeleteAuthoredPostsForBan } from "./club-ban-cleanup.js";
import { lockClubAuthorizationChangesByLinkName } from "./club-authorization-lock.js";

import type {
  ClubBanRecord,
  ClubMemberRecord,
  ClubMembershipRole,
  ClubsRepository,
  ListPublicClubsInput,
  ListPublicClubsResult
} from "./clubs.repository.types.js";
import { toClubDetailRecord } from "./club-detail-record.js";

export type * from "./clubs.repository.types.js";

const publicClubSelect = {
  id: true,
  title: true,
  linkName: true,
  description: true,
  category: true,
  coverAsset: {
    select: {
      objectKey: true,
      status: true
    }
  },
  visibility: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      memberships: true
    }
  }
} as const;

const publicClubDetailSelect = {
  ...publicClubSelect,
  rules: true
} as const;

const clubDetailSelect = (userId: string) => {
  const now = new Date();

  return {
    id: true,
    title: true,
    linkName: true,
    description: true,
    category: true,
    coverAsset: {
      select: {
        objectKey: true,
        status: true
      }
    },
    rules: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
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
    _count: {
      select: {
        memberships: true
      }
    }
  } as const;
};

const clubMemberSelect = (clubId: string, now: Date) =>
  ({
    id: true,
    role: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarAsset: {
          select: {
            objectKey: true,
            status: true
          }
        },
        clubBans: {
          where: {
            clubId,
            ...activeBanWhere(now)
          },
          select: {
            id: true,
            reason: true,
            expiresAt: true,
            createdAt: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    }
  }) as const;

const clubBanSelect = {
  id: true,
  roleAtBan: true,
  reason: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarAsset: {
        select: {
          objectKey: true,
          status: true
        }
      }
    }
  }
} as const;

export const clubsRepository: ClubsRepository = {
  createClubWithOwnerMembership: async (userId, input) =>
    prisma.$transaction(async (transaction) => {
      const club = await transaction.club.create({
        data: {
          title: input.title,
          linkName: input.linkName,
          description: input.description ?? null,
          category: input.category ?? null,
          rules: input.rules ?? null,
          visibility: input.visibility
        },
        select: {
          id: true
        }
      });

      await transaction.clubMembership.create({
        data: {
          clubId: club.id,
          userId,
          role: "OWNER"
        },
        select: {
          id: true
        }
      });

      const createdClub = await transaction.club.findUniqueOrThrow({
        where: {
          id: club.id
        },
        select: clubDetailSelect(userId)
      });

      return toClubDetailRecord(createdClub);
    }),

  findClubByLinkName: (linkName) =>
    prisma.club.findUnique({
      where: {
        linkName
      },
      select: {
        id: true
      }
    }),

  findVisibleClubByLinkNameForUser: async (linkName, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        linkName
      },
      select: clubDetailSelect(userId)
    });

    if (!club) {
      return null;
    }

    const detail = toClubDetailRecord(club);

    if (
      !detail.isCurrentUserBanned &&
      detail.visibility !== "PUBLIC" &&
      !detail.currentUserRole
    ) {
      return null;
    }

    return detail;
  },

  joinPublicClubByLinkName: async (linkName, userId) =>
    prisma.$transaction(async (transaction) => {
      const now = new Date();
      const club = await transaction.club.findUnique({
        where: {
          linkName
        },
        select: {
          id: true,
          visibility: true,
          bans: {
            where: {
              userId,
              ...activeBanWhere(now)
            },
            select: {
              id: true
            },
            take: 1
          }
        }
      });

      if (!club || club.visibility !== "PUBLIC") {
        return {
          status: "NOT_FOUND"
        };
      }

      if (club.bans.length > 0) {
        return {
          status: "BANNED"
        };
      }

      try {
        await transaction.clubMembership.create({
          data: {
            clubId: club.id,
            userId,
            role: "MEMBER"
          },
          select: {
            id: true
          }
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }

      const joinedClub = await transaction.club.findUniqueOrThrow({
        where: {
          id: club.id
        },
        select: clubDetailSelect(userId)
      });

      return {
        status: "SUCCESS",
        club: toClubDetailRecord(joinedClub)
      };
    }),

  leaveClubByLinkName: (linkName, userId) =>
    prisma.$transaction(async (transaction) => {
      await lockClubAuthorizationChangesByLinkName(transaction, linkName);
      const now = new Date();
      const club = await transaction.club.findUnique({
        where: {
          linkName
        },
        select: {
          id: true,
          linkName: true,
          memberships: {
            where: {
              userId
            },
            select: {
              id: true,
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
          }
        }
      });

      if (!club) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (club.bans.length > 0) {
        return {
          status: "ACTOR_BANNED"
        };
      }

      const membership = club.memberships[0];

      if (!membership) {
        return {
          status: "MEMBER_NOT_FOUND"
        };
      }

      if (membership.role === "OWNER") {
        const ownerCount = await transaction.clubMembership.count({
          where: {
            clubId: club.id,
            role: "OWNER"
          }
        });

        if (ownerCount <= 1) {
          return {
            status: "LAST_OWNER"
          };
        }
      }

      await transaction.clubMembership.delete({
        where: {
          id: membership.id
        },
        select: {
          id: true
        }
      });

      await transaction.notification.deleteMany({
        where: {
          clubId: club.id,
          userId
        }
      });

      return {
        status: "SUCCESS",
        club: {
          id: club.id,
          linkName: club.linkName
        }
      };
    }),

  updateClubSettings: (linkName, actorId, input) =>
    prisma.$transaction(async (transaction) => {
      await lockClubAuthorizationChangesByLinkName(transaction, linkName);
      const now = new Date();
      const club = await transaction.club.findUnique({
        where: {
          linkName
        },
        select: {
          id: true,
          visibility: true,
          memberships: {
            where: {
              userId: actorId
            },
            select: {
              role: true
            },
            take: 1
          },
          bans: {
            where: activeUserBanWhere(actorId, now),
            select: {
              id: true
            },
            take: 1
          }
        }
      });

      if (!club) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (club.bans.length > 0) {
        return {
          status: "ACTOR_BANNED"
        };
      }

      const actorRole = club.memberships[0]?.role ?? null;

      if (!actorRole && club.visibility !== "PUBLIC") {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (!canManageClubSettings(actorRole)) {
        return {
          status: "ACTOR_NOT_ALLOWED"
        };
      }

      await transaction.club.update({
        where: {
          id: club.id
        },
        data: {
          rules: input.rules,
          visibility: input.visibility
        },
        select: {
          id: true
        }
      });

      const updatedClub = await transaction.club.findUniqueOrThrow({
        where: {
          id: club.id
        },
        select: clubDetailSelect(actorId)
      });

      return {
        status: "SUCCESS",
        club: toClubDetailRecord(updatedClub)
      };
    }),

  listClubMembersByLinkName: async (linkName, userId, { page, limit, q }) => {
    const skip = getBoundedPageOffset(page, limit);
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
      },
      select: {
        id: true,
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
        }
      }
    });

    if (!club) {
      return {
        club: null,
        members: [],
        total: 0
      };
    }

    const currentUserRole = club.memberships[0]?.role ?? null;
    const isCurrentUserBanned = club.bans.length > 0;

    if (!currentUserRole || isCurrentUserBanned) {
      return {
        club: {
          id: club.id,
          currentUserRole,
          isCurrentUserBanned
        },
        members: [],
        total: 0
      };
    }

    const memberWhere: Prisma.ClubMembershipWhereInput = {
      clubId: club.id,
      ...(q
        ? {
            user: {
              OR: [
                {
                  displayName: {
                    contains: q,
                    mode: "insensitive"
                  }
                },
                {
                  username: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              ]
            }
          }
        : {})
    };

    const [members, total] = await prisma.$transaction([
      prisma.clubMembership.findMany({
        where: memberWhere,
        orderBy: [
          {
            role: "asc"
          },
          {
            createdAt: "asc"
          },
          {
            id: "asc"
          }
        ],
        skip,
        take: limit,
        select: clubMemberSelect(club.id, now)
      }),
      prisma.clubMembership.count({
        where: memberWhere
      })
    ]);

    return {
      club: {
        id: club.id,
        currentUserRole,
        isCurrentUserBanned
      },
      members: members.map(toClubMemberRecord),
      total
    };
  },

  listClubBansByLinkName: async (linkName, userId, { page, limit }) => {
    const skip = getBoundedPageOffset(page, limit);
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
      },
      select: {
        id: true,
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
        }
      }
    });

    if (!club) {
      return {
        club: null,
        bans: [],
        total: 0
      };
    }

    const currentUserRole = club.memberships[0]?.role ?? null;
    const isCurrentUserBanned = club.bans.length > 0;

    if (
      !currentUserRole ||
      isCurrentUserBanned ||
      !canManageClubBans(currentUserRole)
    ) {
      return {
        club: {
          id: club.id,
          currentUserRole,
          isCurrentUserBanned
        },
        bans: [],
        total: 0
      };
    }

    const activeBanWhereInput = {
      clubId: club.id,
      ...activeBanWhere(now)
    } satisfies Prisma.ClubBanWhereInput;
    const [bans, total] = await prisma.$transaction([
      prisma.clubBan.findMany({
        where: activeBanWhereInput,
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
        select: clubBanSelect
      }),
      prisma.clubBan.count({
        where: activeBanWhereInput
      })
    ]);

    return {
      club: {
        id: club.id,
        currentUserRole,
        isCurrentUserBanned
      },
      bans: bans.map(toClubBanRecord),
      total
    };
  },

  updateClubMemberRole: (linkName, membershipId, actorId, role) =>
    prisma.$transaction(async (transaction) => {
      await lockClubAuthorizationChangesByLinkName(transaction, linkName);
      const context = await findMemberManagementContext(
        transaction,
        linkName,
        actorId,
        membershipId
      );

      if (!context.club) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (!context.actorRole) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (context.isActorBanned) {
        return {
          status: "ACTOR_BANNED"
        };
      }

      if (!context.member) {
        return {
          status: "MEMBER_NOT_FOUND"
        };
      }

      if (context.actorRole !== "OWNER") {
        return {
          status: "ACTOR_NOT_ALLOWED"
        };
      }

      if (
        context.member.role === "OWNER" &&
        role !== "OWNER" &&
        context.ownerCount <= 1
      ) {
        return {
          status: "LAST_OWNER"
        };
      }

      await transaction.clubMembership.update({
        where: {
          id: membershipId
        },
        data: {
          role
        },
        select: {
          id: true
        }
      });

      await createAuditLogInTransaction(transaction, {
        action: "CLUB_MEMBER_ROLE_UPDATED",
        actorId,
        clubId: context.club.id,
        targetUserId: context.member.userId,
        metadata: {
          fromRole: context.member.role,
          toRole: role,
          membershipId
        }
      });

      return {
        status: "SUCCESS",
        member: await findMemberRecord(
          transaction,
          membershipId,
          context.club.id
        )
      };
    }),

  banClubMember: (linkName, membershipId, actorId, input) =>
    prisma.$transaction(async (transaction) => {
      await lockClubAuthorizationChangesByLinkName(transaction, linkName);
      const context = await findMemberManagementContext(
        transaction,
        linkName,
        actorId,
        membershipId
      );

      if (!context.club) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (!context.actorRole) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (context.isActorBanned) {
        return {
          status: "ACTOR_BANNED"
        };
      }

      if (!context.member) {
        return {
          status: "MEMBER_NOT_FOUND"
        };
      }

      if (!canActorBanTarget(context.actorRole, context.member.role)) {
        return {
          status: "ACTOR_NOT_ALLOWED"
        };
      }

      if (context.member.role === "OWNER" && context.ownerCount <= 1) {
        return {
          status: "LAST_OWNER"
        };
      }

      const now = new Date();
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      const existingBan = await transaction.clubBan.findFirst({
        where: {
          clubId: context.club.id,
          userId: context.member.userId,
          ...activeBanWhere(now)
        },
        select: {
          id: true
        }
      });
      const ban = existingBan
        ? await transaction.clubBan.update({
            where: {
              id: existingBan.id
            },
            data: {
              reason: input.reason ?? null,
              expiresAt,
              roleAtBan: context.member.role
            },
            select: clubBanSelect
          })
        : await transaction.clubBan.create({
            data: {
              clubId: context.club.id,
              userId: context.member.userId,
              reason: input.reason ?? null,
              roleAtBan: context.member.role,
              expiresAt
            },
            select: clubBanSelect
          });
      const deletedPostCount = input.deleteAuthoredPosts
        ? await softDeleteAuthoredPostsForBan(transaction, {
            actorId,
            banId: ban.id,
            clubId: context.club.id,
            targetUserId: context.member.userId
          })
        : 0;

      await transaction.clubMembership.delete({
        where: {
          id: membershipId
        },
        select: {
          id: true
        }
      });

      await transaction.notification.deleteMany({
        where: {
          clubId: context.club.id,
          userId: context.member.userId
        }
      });

      await createAuditLogInTransaction(transaction, {
        action: "USER_BANNED",
        actorId,
        clubId: context.club.id,
        targetUserId: context.member.userId,
        metadata: {
          banId: ban.id,
          expiresAt: expiresAt?.toISOString() ?? null,
          deletedPostCount,
          deleteAuthoredPosts: Boolean(input.deleteAuthoredPosts),
          membershipId,
          roleAtBan: context.member.role,
          source: "club_members"
        }
      });

      return {
        status: "SUCCESS",
        ban: toClubBanRecord(ban),
        deletedPostCount
      };
    }),

  unbanClubBan: (linkName, banId, actorId) =>
    prisma.$transaction(async (transaction) => {
      const context = await findBanManagementContext(
        transaction,
        linkName,
        actorId,
        banId
      );

      if (!context.club) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (!context.actorRole) {
        return {
          status: "CLUB_NOT_FOUND"
        };
      }

      if (context.isActorBanned) {
        return {
          status: "ACTOR_BANNED"
        };
      }

      if (!context.ban) {
        return {
          status: "BAN_NOT_FOUND"
        };
      }

      if (!canActorUnbanRole(context.actorRole, context.ban.roleAtBan)) {
        return {
          status: "ACTOR_NOT_ALLOWED"
        };
      }

      const now = new Date();
      const updateResult = await transaction.clubBan.updateMany({
        where: {
          clubId: context.club.id,
          userId: context.ban.user.id,
          ...activeBanWhere(now)
        },
        data: {
          revokedAt: now
        }
      });

      if (updateResult.count > 0) {
        await createAuditLogInTransaction(transaction, {
          action: "USER_UNBANNED",
          actorId,
          clubId: context.club.id,
          targetUserId: context.ban.user.id,
          metadata: {
            banId,
            revokedBanCount: updateResult.count,
            roleAtBan: context.ban.roleAtBan,
            source: "club_bans"
          }
        });
      }

      const revokedBan = await transaction.clubBan.findUniqueOrThrow({
        where: {
          id: banId
        },
        select: clubBanSelect
      });

      return {
        status: "SUCCESS",
        ban: toClubBanRecord(revokedBan),
        deletedPostCount: 0
      };
    }),

  listPublicClubs: (userId, input) => listPublicClubsPage(userId, input),

  listPublicSeoClubs: (currentUserId, input) =>
    listPublicClubsPage(currentUserId, input),

  findPublicSeoClubByLinkName: async (linkName, currentUserId) => {
    const now = new Date();
    const club = await prisma.club.findFirst({
      where: {
        ...getPublicClubWhere(currentUserId, now),
        linkName
      },
      select: publicClubDetailSelect
    });

    if (!club) {
      return null;
    }

    const { _count, ...publicClub } = club;

    return {
      ...publicClub,
      visibility: "PUBLIC",
      memberCount: _count.memberships
    };
  },

  listPublicClubSitemapEntries: async (limit) => {
    const entries = await prisma.club.findMany({
      where: {
        visibility: "PUBLIC"
      },
      orderBy: [
        {
          updatedAt: "desc"
        },
        {
          id: "asc"
        }
      ],
      take: limit,
      select: {
        linkName: true,
        updatedAt: true
      }
    });

    return {
      entries
    };
  }
};

const listPublicClubsPage = async (
  currentUserId: string | null,
  { cursor, limit, sort }: ListPublicClubsInput
): Promise<ListPublicClubsResult> => {
  const now = new Date();
  const cursorWhere: Prisma.ClubWhereInput = cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } }
        ]
      }
    : {};
  const clubs = await prisma.club.findMany({
    where: {
      AND: [getPublicClubWhere(currentUserId, now), cursorWhere]
    },
    orderBy: getPublicClubOrder(sort),
    take: sort === "popular" ? limit : limit + 1,
    select: publicClubSelect
  });
  const hasMore = sort === "newest" && clubs.length > limit;
  const pageClubs = clubs.slice(0, limit);
  const lastClub = pageClubs.at(-1);

  return {
    clubs: pageClubs.map(({ _count, ...club }) => ({
      ...club,
      visibility: "PUBLIC",
      memberCount: _count.memberships
    })),
    hasMore,
    nextCursor:
      hasMore && lastClub
        ? { createdAt: lastClub.createdAt, id: lastClub.id }
        : null
  };
};

const getPublicClubWhere = (
  currentUserId: string | null,
  now: Date
): Prisma.ClubWhereInput => ({
  visibility: "PUBLIC",
  ...(currentUserId
    ? {
        bans: {
          none: activeUserBanWhere(currentUserId, now)
        }
      }
    : {})
});

const getPublicClubOrder = (
  sort: ListClubsQuery["sort"] | ListPublicSeoClubsQuery["sort"]
): Prisma.ClubOrderByWithRelationInput[] => {
  if (sort === "popular") {
    return [
      {
        memberships: {
          _count: "desc"
        }
      },
      {
        createdAt: "desc"
      },
      {
        id: "asc"
      }
    ];
  }

  return [
    {
      createdAt: "desc"
    },
    {
      id: "asc"
    }
  ];
};

type TransactionClient = Prisma.TransactionClient;

const findMemberManagementContext = async (
  transaction: TransactionClient,
  linkName: string,
  actorId: string,
  membershipId: string
) => {
  const now = new Date();
  const club = await transaction.club.findUnique({
    where: {
      linkName
    },
    select: {
      id: true,
      memberships: {
        where: {
          userId: actorId
        },
        select: {
          role: true
        },
        take: 1
      },
      bans: {
        where: activeUserBanWhere(actorId, now),
        select: {
          id: true
        },
        take: 1
      }
    }
  });

  if (!club) {
    return {
      club: null,
      actorRole: null,
      isActorBanned: false,
      member: null,
      ownerCount: 0
    };
  }

  const [member, ownerCount] = await Promise.all([
    transaction.clubMembership.findFirst({
      where: {
        id: membershipId,
        clubId: club.id
      },
      select: {
        id: true,
        userId: true,
        role: true
      }
    }),
    transaction.clubMembership.count({
      where: {
        clubId: club.id,
        role: "OWNER"
      }
    })
  ]);

  return {
    club: {
      id: club.id
    },
    actorRole: club.memberships[0]?.role ?? null,
    isActorBanned: club.bans.length > 0,
    member,
    ownerCount
  };
};

const findBanManagementContext = async (
  transaction: TransactionClient,
  linkName: string,
  actorId: string,
  banId: string
) => {
  const now = new Date();
  const club = await transaction.club.findUnique({
    where: {
      linkName
    },
    select: {
      id: true,
      memberships: {
        where: {
          userId: actorId
        },
        select: {
          role: true
        },
        take: 1
      },
      bans: {
        where: activeUserBanWhere(actorId, now),
        select: {
          id: true
        },
        take: 1
      }
    }
  });

  if (!club) {
    return {
      club: null,
      actorRole: null,
      isActorBanned: false,
      ban: null
    };
  }

  const ban = await transaction.clubBan.findFirst({
    where: {
      id: banId,
      clubId: club.id,
      ...activeBanWhere(now)
    },
    select: clubBanSelect
  });

  return {
    club: {
      id: club.id
    },
    actorRole: club.memberships[0]?.role ?? null,
    isActorBanned: club.bans.length > 0,
    ban: ban ? toClubBanRecord(ban) : null
  };
};

const findMemberRecord = async (
  transaction: TransactionClient,
  membershipId: string,
  clubId: string
) => {
  const now = new Date();
  const member = await transaction.clubMembership.findUniqueOrThrow({
    where: {
      id: membershipId
    },
    select: clubMemberSelect(clubId, now)
  });

  return toClubMemberRecord(member);
};

const canManageClubBans = (role: ClubMembershipRole) =>
  role === "OWNER" || role === "MODERATOR";

const canManageClubSettings = (role: ClubMembershipRole | null) =>
  role === "OWNER" || role === "MODERATOR";

const toClubMemberRecord = (member: {
  id: string;
  role: ClubMembershipRole;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarAsset:
      | {
          objectKey: string;
          status: "PENDING" | "READY" | "FAILED";
        }
      | null
      | undefined;
    clubBans: Array<{
      id: string;
      reason: string | null;
      expiresAt: Date | null;
      createdAt: Date;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}): ClubMemberRecord => {
  const { clubBans, ...user } = member.user;

  return {
    id: member.id,
    role: member.role,
    user,
    activeBan: clubBans[0] ?? null,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  };
};

const toClubBanRecord = (ban: {
  id: string;
  roleAtBan: ClubMembershipRole | null;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarAsset:
      | {
          objectKey: string;
          status: "PENDING" | "READY" | "FAILED";
        }
      | null
      | undefined;
  };
  reason: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ClubBanRecord => ({
  id: ban.id,
  roleAtBan: ban.roleAtBan,
  user: ban.user,
  reason: ban.reason,
  expiresAt: ban.expiresAt,
  revokedAt: ban.revokedAt,
  createdAt: ban.createdAt,
  updatedAt: ban.updatedAt
});
