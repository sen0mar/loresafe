import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  CreateMilestoneRequest,
  CreateMilestoneTemplateRequest,
  ListMilestonesQuery
} from "./milestones.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubMilestoneCreationClubRecord = {
  id: string;
  currentUserRole: ClubMembershipRole | null;
};

export type MilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  description: string | null;
  spoilerName: boolean;
};

export type ListMilestonesResult = {
  milestones: MilestoneRecord[];
  total: number;
};

export type MilestonesRepository = {
  createMilestonesFromTemplateIfEmpty: (
    input: CreateMilestonesFromTemplateIfEmptyInput
  ) => Promise<MilestoneRecord[]>;
  createMilestoneAtNextPosition: (
    input: CreateMilestoneAtNextPositionInput
  ) => Promise<MilestoneRecord>;
  findClubForMilestoneCreation: (
    slug: string,
    userId: string
  ) => Promise<ClubMilestoneCreationClubRecord | null>;
  listVisibleMilestonesByClubSlug: (
    slug: string,
    userId: string,
    query: ListMilestonesQuery
  ) => Promise<ListMilestonesResult | null>;
};

type CreateMilestoneAtNextPositionInput = CreateMilestoneRequest & {
  clubId: string;
};

type CreateMilestonesFromTemplateIfEmptyInput =
  CreateMilestoneTemplateRequest & {
    clubId: string;
    milestones: Array<{
      safeTitle: string;
      fullTitle: null;
      description: null;
      spoilerName: false;
    }>;
  };

export class MilestoneTemplateConflictError extends Error {
  constructor() {
    super("Milestone template generation requires an empty timeline.");
    this.name = "MilestoneTemplateConflictError";
  }
}

const milestoneSelect = {
  id: true,
  position: true,
  safeTitle: true,
  fullTitle: true,
  description: true,
  spoilerName: true
} as const;

export const milestonesRepository: MilestonesRepository = {
  createMilestonesFromTemplateIfEmpty: async (input) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        const existingMilestoneCount = await transaction.milestone.count({
          where: {
            clubId: input.clubId
          }
        });

        if (existingMilestoneCount > 0) {
          throw new MilestoneTemplateConflictError();
        }

        const createdMilestones = [];

        for (const [index, milestone] of input.milestones.entries()) {
          createdMilestones.push(
            await transaction.milestone.create({
              data: {
                clubId: input.clubId,
                position: index + 1,
                safeTitle: milestone.safeTitle,
                fullTitle: milestone.fullTitle,
                description: milestone.description,
                spoilerName: milestone.spoilerName
              },
              select: milestoneSelect
            })
          );
        }

        return createdMilestones;
      });
    } catch (error) {
      if (error instanceof MilestoneTemplateConflictError) {
        throw error;
      }

      if (isUniqueConstraintError(error)) {
        throw new MilestoneTemplateConflictError();
      }

      throw error;
    }
  },

  createMilestoneAtNextPosition: async (input) => {
    const createMilestone = async () =>
      prisma.$transaction(async (transaction) => {
        const lastMilestone = await transaction.milestone.findFirst({
          where: {
            clubId: input.clubId
          },
          orderBy: {
            position: "desc"
          },
          select: {
            position: true
          }
        });

        return transaction.milestone.create({
          data: {
            clubId: input.clubId,
            position: (lastMilestone?.position ?? 0) + 1,
            safeTitle: input.safeTitle,
            fullTitle: input.fullTitle ?? null,
            description: input.description ?? null,
            spoilerName: input.spoilerName
          },
          select: milestoneSelect
        });
      });

    try {
      return await createMilestone();
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      return createMilestone();
    }
  },

  findClubForMilestoneCreation: async (slug, userId) => {
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
        }
      }
    });

    if (
      !club ||
      (club.visibility !== "PUBLIC" && club.memberships.length === 0)
    ) {
      return null;
    }

    return {
      id: club.id,
      currentUserRole: club.memberships[0]?.role ?? null
    };
  },

  listVisibleMilestonesByClubSlug: async (slug, userId, { page, limit }) => {
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
            id: true
          },
          take: 1
        }
      }
    });

    if (!club || !canViewClubMilestones(club)) {
      return null;
    }

    const skip = (page - 1) * limit;

    const [milestones, total] = await prisma.$transaction([
      prisma.milestone.findMany({
        where: {
          clubId: club.id
        },
        orderBy: [
          {
            position: "asc"
          },
          {
            id: "asc"
          }
        ],
        skip,
        take: limit,
        select: milestoneSelect
      }),
      prisma.milestone.count({
        where: {
          clubId: club.id
        }
      })
    ]);

    return {
      milestones,
      total
    };
  }
};

const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as Prisma.PrismaClientKnownRequestError).code === "P2002";

const canViewClubMilestones = (club: {
  visibility: ClubVisibility;
  memberships: Array<{ id: string }>;
}) => club.visibility === "PUBLIC" || club.memberships.length > 0;
