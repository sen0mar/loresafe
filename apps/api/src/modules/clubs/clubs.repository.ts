import { prisma } from "../../core/prisma/client.js";
import type {
  CreateClubRequest,
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
  ) => Promise<ClubDetailRecord | null>;
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
      const club = await transaction.club.findUnique({
        where: {
          slug
        },
        select: {
          id: true,
          visibility: true
        }
      });

      if (!club || club.visibility !== "PUBLIC") {
        return null;
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

      return toClubDetailRecord(joinedClub);
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
