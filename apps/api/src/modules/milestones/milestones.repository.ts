import { prisma } from "../../core/prisma/client.js";
import type { ListMilestonesQuery } from "./milestones.schema.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

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
  listVisibleMilestonesByClubSlug: (
    slug: string,
    userId: string,
    query: ListMilestonesQuery
  ) => Promise<ListMilestonesResult | null>;
};

const milestoneSelect = {
  id: true,
  position: true,
  safeTitle: true,
  fullTitle: true,
  description: true,
  spoilerName: true
} as const;

export const milestonesRepository: MilestonesRepository = {
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

const canViewClubMilestones = (club: {
  visibility: ClubVisibility;
  memberships: Array<{ id: string }>;
}) => club.visibility === "PUBLIC" || club.memberships.length > 0;
