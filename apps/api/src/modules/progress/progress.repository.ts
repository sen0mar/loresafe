import { prisma } from "../../core/prisma/client.js";
import type { ProgressMode, UpdateProgressRequest } from "./progress.schema.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ProgressClubRecord = {
  id: string;
  currentUserRole: ClubMembershipRole | null;
};

export type ProgressMilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  spoilerName: boolean;
};

export type ProgressHistoryRecord = {
  id: string;
  fromMode: ProgressMode;
  toMode: ProgressMode;
  fromMilestone: ProgressMilestoneRecord | null;
  toMilestone: ProgressMilestoneRecord | null;
  createdAt: Date;
};

export type ClubProgressRecord = {
  id: string | null;
  mode: ProgressMode;
  currentMilestone: ProgressMilestoneRecord | null;
  totalMilestones: number;
  history: ProgressHistoryRecord[];
  updatedAt: Date | null;
};

export type ProgressRepository = {
  findClubForProgress: (
    slug: string,
    userId: string
  ) => Promise<ProgressClubRecord | null>;
  getProgressForUserClub: (
    userId: string,
    clubId: string
  ) => Promise<ClubProgressRecord>;
  updateProgressForUserClub: (
    userId: string,
    clubId: string,
    input: UpdateProgressRequest
  ) => Promise<ClubProgressRecord | null>;
};

const milestoneSelect = {
  id: true,
  position: true,
  safeTitle: true,
  fullTitle: true,
  spoilerName: true
} as const;

const historySelect = {
  id: true,
  fromMode: true,
  toMode: true,
  fromMilestone: {
    select: milestoneSelect
  },
  toMilestone: {
    select: milestoneSelect
  },
  createdAt: true
} as const;

export const progressRepository: ProgressRepository = {
  findClubForProgress: async (slug, userId) => {
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
      return null;
    }

    return {
      id: club.id,
      currentUserRole: club.memberships[0]?.role ?? null
    };
  },

  getProgressForUserClub: async (userId, clubId) => {
    const [progress, totalMilestones, history] = await prisma.$transaction([
      prisma.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          id: true,
          mode: true,
          currentMilestone: {
            select: milestoneSelect
          },
          updatedAt: true
        }
      }),
      prisma.milestone.count({
        where: {
          clubId
        }
      }),
      prisma.progressHistory.findMany({
        where: {
          userId,
          clubId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: historySelect
      })
    ]);

    return {
      id: progress?.id ?? null,
      mode: (progress?.mode ?? "STRICT") as ProgressMode,
      currentMilestone: progress?.currentMilestone ?? null,
      totalMilestones,
      history: history.map(toProgressHistoryRecord),
      updatedAt: progress?.updatedAt ?? null
    };
  },

  updateProgressForUserClub: async (userId, clubId, input) =>
    prisma.$transaction(async (transaction) => {
      if (input.currentMilestoneId) {
        const milestone = await transaction.milestone.findFirst({
          where: {
            id: input.currentMilestoneId,
            clubId
          },
          select: {
            id: true
          }
        });

        if (!milestone) {
          return null;
        }
      }

      const existingProgress = await transaction.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          id: true,
          mode: true,
          currentMilestoneId: true
        }
      });

      const fromMode = (existingProgress?.mode ?? "STRICT") as ProgressMode;
      const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
      const hasChanged =
        fromMode !== input.mode ||
        fromMilestoneId !== input.currentMilestoneId;

      await transaction.clubProgress.upsert({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        create: {
          userId,
          clubId,
          currentMilestoneId: input.currentMilestoneId,
          mode: input.mode
        },
        update: {
          currentMilestoneId: input.currentMilestoneId,
          mode: input.mode
        },
        select: {
          id: true
        }
      });

      if (hasChanged) {
        await transaction.progressHistory.create({
          data: {
            userId,
            clubId,
            fromMilestoneId,
            toMilestoneId: input.currentMilestoneId,
            fromMode,
            toMode: input.mode
          },
          select: {
            id: true
          }
        });
      }

      const [progress, totalMilestones, history] = await Promise.all([
        transaction.clubProgress.findUniqueOrThrow({
          where: {
            userId_clubId: {
              userId,
              clubId
            }
          },
          select: {
            id: true,
            mode: true,
            currentMilestone: {
              select: milestoneSelect
            },
            updatedAt: true
          }
        }),
        transaction.milestone.count({
          where: {
            clubId
          }
        }),
        transaction.progressHistory.findMany({
          where: {
            userId,
            clubId
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 5,
          select: historySelect
        })
      ]);

      return {
        id: progress.id,
        mode: progress.mode as ProgressMode,
        currentMilestone: progress.currentMilestone,
        totalMilestones,
        history: history.map(toProgressHistoryRecord),
        updatedAt: progress.updatedAt
      };
    })
};

const toProgressHistoryRecord = (history: {
  id: string;
  fromMode: string;
  toMode: string;
  fromMilestone: ProgressMilestoneRecord | null;
  toMilestone: ProgressMilestoneRecord | null;
  createdAt: Date;
}): ProgressHistoryRecord => ({
  id: history.id,
  fromMode: history.fromMode as ProgressMode,
  toMode: history.toMode as ProgressMode,
  fromMilestone: history.fromMilestone,
  toMilestone: history.toMilestone,
  createdAt: history.createdAt
});
