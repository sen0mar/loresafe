import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  BanClubMemberRequest,
  CreateClubRequest,
  ListClubMembersQuery,
  ListClubsQuery
} from "./clubs.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubDiscoveryRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverAsset?: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null | undefined;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ClubDetailRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverAsset?: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null | undefined;
  rules: string | null;
  visibility: ClubVisibility;
  memberCount: number;
  currentUserRole: ClubMembershipRole | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListPublicClubsResult = {
  clubs: ClubDiscoveryRecord[];
  total: number;
};

export type ClubMemberRecord = {
  id: string;
  role: ClubMembershipRole;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarAsset?: {
      objectKey: string;
      status: "PENDING" | "READY" | "FAILED";
    } | null | undefined;
  };
  activeBan: {
    id: string;
    reason: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListClubMembersResult = {
  club: {
    id: string;
    currentUserRole: ClubMembershipRole | null;
  } | null;
  members: ClubMemberRecord[];
  total: number;
};

export type ClubMemberMutationResult =
  | {
      status: "SUCCESS";
      member: ClubMemberRecord;
    }
  | {
      status:
        | "ACTOR_NOT_ALLOWED"
        | "CLUB_NOT_FOUND"
        | "LAST_OWNER"
        | "MEMBER_NOT_FOUND";
    };

export type JoinPublicClubResult =
  | {
      status: "SUCCESS";
      club: ClubDetailRecord;
    }
  | {
      status: "BANNED" | "NOT_FOUND";
    };

export type ClubsRepository = {
  createClubWithOwnerMembership: (
    userId: string,
    input: CreateClubRequest
  ) => Promise<ClubDetailRecord>;
  findClubBySlug: (slug: string) => Promise<{ id: string } | null>;
  findVisibleClubBySlugForUser: (
    slug: string,
    userId: string
  ) => Promise<ClubDetailRecord | null>;
  joinPublicClubBySlug: (
    slug: string,
    userId: string
  ) => Promise<JoinPublicClubResult>;
  listClubMembersBySlug: (
    slug: string,
    userId: string,
    input: ListClubMembersQuery
  ) => Promise<ListClubMembersResult>;
  updateClubMemberRole: (
    slug: string,
    membershipId: string,
    actorId: string,
    role: ClubMembershipRole
  ) => Promise<ClubMemberMutationResult>;
  banClubMember: (
    slug: string,
    membershipId: string,
    actorId: string,
    input: BanClubMemberRequest
  ) => Promise<ClubMemberMutationResult>;
  unbanClubMember: (
    slug: string,
    membershipId: string,
    actorId: string
  ) => Promise<ClubMemberMutationResult>;
  listPublicClubs: (
    input: ListClubsQuery
  ) => Promise<ListPublicClubsResult>;
};

const publicClubSelect = {
  id: true,
  title: true,
  slug: true,
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

const clubDetailSelect = (userId: string) =>
  ({
    id: true,
    title: true,
    slug: true,
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
    _count: {
      select: {
        memberships: true
      }
    }
  }) as const;

const clubMemberSelect = (now: Date) =>
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
        }
      }
    },
    club: {
      select: {
        bans: {
          where: activeBanWhere(now),
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

const activeBanWhere = (now: Date) =>
  ({
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
  });

export const clubsRepository: ClubsRepository = {
  createClubWithOwnerMembership: async (userId, input) =>
    prisma.$transaction(async (transaction) => {
      const club = await transaction.club.create({
        data: {
          title: input.title,
          slug: input.slug,
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

  findClubBySlug: (slug) =>
    prisma.club.findUnique({
      where: {
        slug
      },
      select: {
        id: true
      }
    }),

  findVisibleClubBySlugForUser: async (slug, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        slug
      },
      select: clubDetailSelect(userId)
    });

    if (!club) {
      return null;
    }

    const detail = toClubDetailRecord(club);

    if (detail.visibility !== "PUBLIC" && !detail.currentUserRole) {
      return null;
    }

    return detail;
  },

  joinPublicClubBySlug: async (slug, userId) =>
    prisma.$transaction(async (transaction) => {
      const now = new Date();
      const club = await transaction.club.findUnique({
        where: {
          slug
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

  listClubMembersBySlug: async (slug, userId, { page, limit }) => {
    const skip = (page - 1) * limit;
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        slug
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

    if (!currentUserRole) {
      return {
        club: {
          id: club.id,
          currentUserRole
        },
        members: [],
        total: 0
      };
    }

    const [members, total] = await prisma.$transaction([
      prisma.clubMembership.findMany({
        where: {
          clubId: club.id
        },
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
        select: clubMemberSelect(now)
      }),
      prisma.clubMembership.count({
        where: {
          clubId: club.id
        }
      })
    ]);

    return {
      club: {
        id: club.id,
        currentUserRole
      },
      members: members.map(toClubMemberRecord),
      total
    };
  },

  updateClubMemberRole: (slug, membershipId, actorId, role) =>
    prisma.$transaction(async (transaction) => {
      const context = await findMemberManagementContext(
        transaction,
        slug,
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
        member: await findMemberRecord(transaction, membershipId)
      };
    }),

  banClubMember: (slug, membershipId, actorId, input) =>
    prisma.$transaction(async (transaction) => {
      const context = await findMemberManagementContext(
        transaction,
        slug,
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
              expiresAt
            },
            select: {
              id: true
            }
          })
        : await transaction.clubBan.create({
            data: {
              clubId: context.club.id,
              userId: context.member.userId,
              reason: input.reason ?? null,
              expiresAt
            },
            select: {
              id: true
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
          membershipId,
          source: "club_members"
        }
      });

      return {
        status: "SUCCESS",
        member: await findMemberRecord(transaction, membershipId)
      };
    }),

  unbanClubMember: (slug, membershipId, actorId) =>
    prisma.$transaction(async (transaction) => {
      const context = await findMemberManagementContext(
        transaction,
        slug,
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

      const now = new Date();
      const updateResult = await transaction.clubBan.updateMany({
        where: {
          clubId: context.club.id,
          userId: context.member.userId,
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
          targetUserId: context.member.userId,
          metadata: {
            revokedBanCount: updateResult.count,
            membershipId,
            source: "club_members"
          }
        });
      }

      return {
        status: "SUCCESS",
        member: await findMemberRecord(transaction, membershipId)
      };
    }),

  listPublicClubs: async ({ page, limit }) => {
    const skip = (page - 1) * limit;

    const [clubs, total] = await prisma.$transaction([
      prisma.club.findMany({
        where: {
          visibility: "PUBLIC"
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
        select: publicClubSelect
      }),
      prisma.club.count({
        where: {
          visibility: "PUBLIC"
        }
      })
    ]);

    return {
      clubs: clubs.map(({ _count, ...club }) => ({
        ...club,
        visibility: "PUBLIC",
        memberCount: _count.memberships
      })),
      total
    };
  }
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

type TransactionClient = Prisma.TransactionClient;
type AuditLogAction =
  | "CLUB_MEMBER_ROLE_UPDATED"
  | "USER_BANNED"
  | "USER_UNBANNED";

const canActorBanTarget = (
  actorRole: ClubMembershipRole,
  targetRole: ClubMembershipRole
) => actorRole === "OWNER" || (actorRole === "MODERATOR" && targetRole === "MEMBER");

const findMemberManagementContext = async (
  transaction: TransactionClient,
  slug: string,
  actorId: string,
  membershipId: string
) => {
  const club = await transaction.club.findUnique({
    where: {
      slug
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
      }
    }
  });

  if (!club) {
    return {
      club: null,
      actorRole: null,
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
    member,
    ownerCount
  };
};

const findMemberRecord = async (
  transaction: TransactionClient,
  membershipId: string
) => {
  const now = new Date();
  const member = await transaction.clubMembership.findUniqueOrThrow({
    where: {
      id: membershipId
    },
    select: clubMemberSelect(now)
  });

  return toClubMemberRecord(member);
};

const createAuditLogInTransaction = (
  transaction: TransactionClient,
  input: {
    action: AuditLogAction;
    actorId: string;
    clubId: string;
    targetUserId: string;
    metadata: Prisma.InputJsonObject;
  }
) =>
  transaction.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      clubId: input.clubId,
      reportId: null,
      postId: null,
      commentId: null,
      targetUserId: input.targetUserId,
      moderatorNote: null,
      metadata: input.metadata
    },
    select: {
      id: true
    }
  });

const toClubDetailRecord = (club: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverAsset: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null | undefined;
  rules: string | null;
  visibility: ClubVisibility;
  createdAt: Date;
  updatedAt: Date;
  memberships: Array<{ role: ClubMembershipRole }>;
  _count: {
    memberships: number;
  };
}): ClubDetailRecord => ({
  id: club.id,
  title: club.title,
  slug: club.slug,
  description: club.description,
  category: club.category,
  coverAsset: club.coverAsset,
  rules: club.rules,
  visibility: club.visibility,
  memberCount: club._count.memberships,
  currentUserRole: club.memberships[0]?.role ?? null,
  createdAt: club.createdAt,
  updatedAt: club.updatedAt
});

const toClubMemberRecord = (member: {
  id: string;
  role: ClubMembershipRole;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarAsset: {
      objectKey: string;
      status: "PENDING" | "READY" | "FAILED";
    } | null | undefined;
  };
  club: {
    bans: Array<{
      id: string;
      reason: string | null;
      expiresAt: Date | null;
      createdAt: Date;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}): ClubMemberRecord => ({
  id: member.id,
  role: member.role,
  user: member.user,
  activeBan: member.club.bans[0] ?? null,
  createdAt: member.createdAt,
  updatedAt: member.updatedAt
});
