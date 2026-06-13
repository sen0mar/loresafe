import { prisma } from "../../core/prisma/client.js";
import type { ListClubsQuery } from "./clubs.schema.js";

export type ClubDiscoveryRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ListPublicClubsResult = {
  clubs: ClubDiscoveryRecord[];
  total: number;
};

export type ClubsRepository = {
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
  visibility: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      memberships: true
    }
  }
} as const;

export const clubsRepository: ClubsRepository = {
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
