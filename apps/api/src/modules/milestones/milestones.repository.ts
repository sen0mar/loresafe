import { prisma } from "../../core/prisma/client.js";
import { getBoundedPageOffset } from "../../core/http/pagination.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  CreateMilestoneRequest,
  CreateMilestoneTemplateRequest,
  ListMilestonesQuery,
  MoveMilestoneRequest,
  UpdateMilestoneRequest
} from "./milestones.schema.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { lockClubAuthorizationChanges } from "../clubs/club-authorization-lock.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ClubMilestoneCreationClubRecord = {
  id: string;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
};

export type MilestoneRecord = {
  id: string;
  position: number;
  safeTitle: string;
  fullTitle: string | null;
  description: string | null;
  spoilerName: boolean;
};

export type MilestoneViewerProgress = {
  mode: ProgressMode;
  currentMilestonePosition: number | null;
};

export type ListMilestonesResult = {
  status: "SUCCESS";
  milestones: MilestoneRecord[];
  total: number;
  viewerProgress: MilestoneViewerProgress;
} | {
  status: "BANNED";
};

export type MilestonesRepository = {
  createMilestonesFromTemplateIfEmpty: (
    input: CreateMilestonesFromTemplateIfEmptyInput
  ) => Promise<MilestoneRecord[]>;
  createMilestoneAtNextPosition: (
    input: CreateMilestoneAtNextPositionInput
  ) => Promise<MilestoneRecord>;
  updateMilestoneForClub: (
    input: UpdateMilestoneForClubInput
  ) => Promise<MilestoneRecord | null>;
  moveMilestoneForClub: (
    input: MoveMilestoneForClubInput
  ) => Promise<MilestoneRecord[] | null>;
  findClubForMilestoneCreation: (
    linkName: string,
    userId: string
  ) => Promise<ClubMilestoneCreationClubRecord | null>;
  listVisibleMilestonesByClubLinkName: (
    linkName: string,
    userId: string,
    query: ListMilestonesQuery
  ) => Promise<ListMilestonesResult | null>;
};

type CreateMilestoneAtNextPositionInput = CreateMilestoneRequest & {
  clubId: string;
  actorId: string;
};

type UpdateMilestoneForClubInput = UpdateMilestoneRequest & {
  clubId: string;
  milestoneId: string;
  actorId: string;
};

type MoveMilestoneForClubInput = MoveMilestoneRequest & {
  clubId: string;
  milestoneId: string;
  actorId: string;
};

type CreateMilestonesFromTemplateIfEmptyInput =
  CreateMilestoneTemplateRequest & {
    clubId: string;
    actorId: string;
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

export class MilestoneMoveConflictError extends Error {
  constructor() {
    super("Milestone move could not be applied.");
    this.name = "MilestoneMoveConflictError";
  }
}

export class MilestoneAuthorizationChangedError extends Error {
  constructor() {
    super("Milestone authorization changed before the update completed.");
    this.name = "MilestoneAuthorizationChangedError";
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
        await assertCanManageMilestones(transaction, input.clubId, input.actorId);
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
        await assertCanManageMilestones(transaction, input.clubId, input.actorId);
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

  updateMilestoneForClub: (input) =>
    prisma.$transaction(async (transaction) => {
      await assertCanManageMilestones(transaction, input.clubId, input.actorId);
      const existingMilestone = await transaction.milestone.findFirst({
        where: {
          id: input.milestoneId,
          clubId: input.clubId
        },
        select: {
          id: true
        }
      });

      if (!existingMilestone) {
        return null;
      }

      return transaction.milestone.update({
        where: {
          id: input.milestoneId
        },
        data: {
          safeTitle: input.safeTitle,
          fullTitle: input.fullTitle ?? null,
          description: input.description ?? null,
          spoilerName: input.spoilerName
        },
        select: milestoneSelect
      });
    }),

  moveMilestoneForClub: async (input) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        await assertCanManageMilestones(transaction, input.clubId, input.actorId);
        const milestone = await transaction.milestone.findFirst({
          where: {
            id: input.milestoneId,
            clubId: input.clubId
          },
          select: {
            id: true,
            position: true
          }
        });

        if (!milestone) {
          return null;
        }

        const adjacentPosition =
          input.direction === "UP"
            ? milestone.position - 1
            : milestone.position + 1;
        const adjacentMilestone = await transaction.milestone.findFirst({
          where: {
            clubId: input.clubId,
            position: adjacentPosition
          },
          select: {
            id: true,
            position: true
          }
        });

        if (!adjacentMilestone) {
          throw new MilestoneMoveConflictError();
        }

        const maxPosition = await transaction.milestone.aggregate({
          where: {
            clubId: input.clubId
          },
          _max: {
            position: true
          }
        });
        const temporaryPosition = (maxPosition._max.position ?? 0) + 1;

        await transaction.milestone.update({
          where: {
            id: milestone.id
          },
          data: {
            position: temporaryPosition
          },
          select: {
            id: true
          }
        });
        await transaction.milestone.update({
          where: {
            id: adjacentMilestone.id
          },
          data: {
            position: milestone.position
          },
          select: {
            id: true
          }
        });
        await transaction.milestone.update({
          where: {
            id: milestone.id
          },
          data: {
            position: adjacentMilestone.position
          },
          select: {
            id: true
          }
        });

        return transaction.milestone.findMany({
          where: {
            clubId: input.clubId
          },
          orderBy: [
            {
              position: "asc"
            },
            {
              id: "asc"
            }
          ],
          select: milestoneSelect
        });
      });
    } catch (error) {
      if (error instanceof MilestoneMoveConflictError) {
        throw error;
      }

      if (isUniqueConstraintError(error)) {
        throw new MilestoneMoveConflictError();
      }

      throw error;
    }
  },

  findClubForMilestoneCreation: async (linkName, userId) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
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

    if (
      !club ||
      (club.visibility !== "PUBLIC" && club.memberships.length === 0)
    ) {
      return null;
    }

    return {
      id: club.id,
      currentUserRole: club.memberships[0]?.role ?? null,
      isCurrentUserBanned: club.bans.length > 0
    };
  },

  listVisibleMilestonesByClubLinkName: async (linkName, userId, { page, limit }) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
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

    if (club?.bans.length) {
      return {
        status: "BANNED"
      };
    }

    if (!club || !canViewClubMilestones(club)) {
      return null;
    }

    const skip = getBoundedPageOffset(page, limit);

    const [milestones, total, progress] = await prisma.$transaction([
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
      }),
      prisma.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId: club.id
          }
        },
        select: {
          mode: true,
          currentMilestone: {
            select: {
              position: true
            }
          }
        }
      })
    ]);

    return {
      status: "SUCCESS",
      milestones,
      total,
      viewerProgress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition: progress?.currentMilestone?.position ?? null
      }
    };
  }
};

const assertCanManageMilestones = async (
  transaction: Prisma.TransactionClient,
  clubId: string,
  actorId: string
) => {
  if (!(await lockClubAuthorizationChanges(transaction, clubId))) {
    throw new MilestoneAuthorizationChangedError();
  }

  const now = new Date();
  const club = await transaction.club.findFirst({
    where: {
      id: clubId,
      memberships: {
        some: {
          userId: actorId,
          role: {
            in: ["OWNER", "MODERATOR"]
          }
        }
      },
      bans: {
        none: activeUserBanWhere(actorId, now)
      }
    },
    select: {
      id: true
    }
  });

  if (!club) {
    throw new MilestoneAuthorizationChangedError();
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
