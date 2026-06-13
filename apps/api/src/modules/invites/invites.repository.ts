import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ClubDetailRecord } from "../clubs/clubs.repository.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";
type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

export type ClubInviteCreationClubRecord = {
  id: string;
  title: string;
  slug: string;
  currentUserRole: ClubMembershipRole | null;
};

export type CreateClubInviteInput = {
  clubId: string;
  createdById: string;
  tokenHash: string;
  expiresAt: Date;
  maxUses: number;
};

export type ClubInviteRecord = {
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  revokedAt: Date | null;
  createdAt: Date;
  club: {
    id: string;
    title: string;
    slug: string;
  };
};

export type AcceptInviteFailureStatus =
  | "expired"
  | "maxed"
  | "not_found"
  | "revoked";

export type AcceptInviteSuccessRecord = {
  status: "accepted" | "already_member";
  club: ClubDetailRecord;
};

export type AcceptInviteRecord =
  | AcceptInviteSuccessRecord
  | {
      status: AcceptInviteFailureStatus;
    };

export type InvitesRepository = {
  acceptInviteByTokenHash: (
    tokenHash: string,
    userId: string,
    now: Date
  ) => Promise<AcceptInviteRecord>;
  createClubInvite: (input: CreateClubInviteInput) => Promise<ClubInviteRecord>;
  findClubForInviteCreation: (
    slug: string,
    userId: string
  ) => Promise<ClubInviteCreationClubRecord | null>;
};

const inviteSelect = {
  expiresAt: true,
  maxUses: true,
  usedCount: true,
  revokedAt: true,
  createdAt: true,
  club: {
    select: {
      id: true,
      title: true,
      slug: true
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

const inviteStateSelect = {
  id: true,
  clubId: true,
  expiresAt: true,
  maxUses: true,
  usedCount: true,
  revokedAt: true
} as const;

class InviteAcceptFailure extends Error {
  readonly status: AcceptInviteFailureStatus;

  constructor(status: AcceptInviteFailureStatus) {
    super(status);
    this.name = "InviteAcceptFailure";
    this.status = status;
  }
}

export const invitesRepository: InvitesRepository = {
  acceptInviteByTokenHash: async (tokenHash, userId, now) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        const invite = await transaction.clubInvite.findUnique({
          where: {
            tokenHash
          },
          select: inviteStateSelect
        });

        if (!invite) {
          return {
            status: "not_found"
          };
        }

        const existingMembership = await transaction.clubMembership.findUnique({
          where: {
            userId_clubId: {
              userId,
              clubId: invite.clubId
            }
          },
          select: {
            id: true
          }
        });

        if (existingMembership) {
          return {
            status: "already_member",
            club: await findClubDetail(transaction, invite.clubId, userId)
          };
        }

        const failureStatus = getInviteFailureStatus(invite, now);

        if (failureStatus) {
          return {
            status: failureStatus
          };
        }

        const membershipResult = await transaction.clubMembership.createMany({
          data: {
            clubId: invite.clubId,
            userId,
            role: "MEMBER"
          },
          skipDuplicates: true
        });

        if (membershipResult.count === 0) {
          return {
            status: "already_member",
            club: await findClubDetail(transaction, invite.clubId, userId)
          };
        }

        const updateResult = await transaction.clubInvite.updateMany({
          where: {
            id: invite.id,
            revokedAt: null,
            expiresAt: {
              gt: now
            },
            usedCount: {
              lt: invite.maxUses
            }
          },
          data: {
            usedCount: {
              increment: 1
            }
          }
        });

        if (updateResult.count === 0) {
          const freshInvite = await transaction.clubInvite.findUnique({
            where: {
              id: invite.id
            },
            select: inviteStateSelect
          });

          throw new InviteAcceptFailure(
            freshInvite
              ? getInviteFailureStatus(freshInvite, now) ?? "maxed"
              : "not_found"
          );
        }

        return {
          status: "accepted",
          club: await findClubDetail(transaction, invite.clubId, userId)
        };
      });
    } catch (error) {
      if (error instanceof InviteAcceptFailure) {
        return {
          status: error.status
        };
      }

      throw error;
    }
  },

  createClubInvite: async ({
    clubId,
    createdById,
    tokenHash,
    expiresAt,
    maxUses
  }) =>
    prisma.clubInvite.create({
      data: {
        clubId,
        createdById,
        tokenHash,
        expiresAt,
        maxUses
      },
      select: inviteSelect
    }),

  findClubForInviteCreation: async (slug, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        slug
      },
      select: {
        id: true,
        title: true,
        slug: true,
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
      return null;
    }

    return {
      id: club.id,
      title: club.title,
      slug: club.slug,
      currentUserRole: club.memberships[0]?.role ?? null
    };
  }
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

const getInviteFailureStatus = (
  invite: {
    expiresAt: Date;
    maxUses: number;
    usedCount: number;
    revokedAt: Date | null;
  },
  now: Date
): AcceptInviteFailureStatus | null => {
  if (invite.revokedAt) {
    return "revoked";
  }

  if (invite.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  if (invite.usedCount >= invite.maxUses) {
    return "maxed";
  }

  return null;
};

const findClubDetail = async (
  transaction: Prisma.TransactionClient,
  clubId: string,
  userId: string
): Promise<ClubDetailRecord> => {
  const club = await transaction.club.findUniqueOrThrow({
    where: {
      id: clubId
    },
    select: clubDetailSelect(userId)
  });

  return toClubDetailRecord(club);
};

const toClubDetailRecord = (club: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
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
  rules: club.rules,
  visibility: club.visibility,
  memberCount: club._count.memberships,
  currentUserRole: club.memberships[0]?.role ?? null,
  createdAt: club.createdAt,
  updatedAt: club.updatedAt
});
