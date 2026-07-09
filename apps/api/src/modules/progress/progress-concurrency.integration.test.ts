import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import {
  startNotificationJobQueue,
  stopNotificationJobQueue
} from "../../jobs/notification-job-queue.js";
import { progressRepository } from "./progress.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("progress command database invariants", () => {
  beforeAll(async () => {
    await startNotificationJobQueue();
  });

  afterAll(async () => {
    await stopNotificationJobQueue();
  });

  it("deduplicates concurrent retries and keeps a versioned history chain", async () => {
    const suffix = crypto.randomUUID();
    let clubId: string | null = null;
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `progress-race-${suffix}@example.com`,
          displayName: `progress-${suffix}`.slice(0, 80),
          username: `progress_${suffix}`.slice(0, 30),
          passwordHash: "$argon2id$v=19$integration-fixture"
        },
        select: {
          id: true
        }
      });
      userId = user.id;
      const club = await prisma.club.create({
        data: {
          title: "Progress race fixture",
          linkName: `progress-race-${suffix}`,
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER"
            }
          },
          milestones: {
            create: [
              {
                position: 1,
                safeTitle: "Opening"
              },
              {
                position: 2,
                safeTitle: "Finale"
              }
            ]
          }
        },
        select: {
          id: true
        }
      });
      clubId = club.id;
      const retryCommandId = crypto.randomUUID();

      const duplicateResults = await Promise.all([
        progressRepository.advanceProgressToNextMilestoneForUserClub(
          user.id,
          club.id,
          retryCommandId
        ),
        progressRepository.advanceProgressToNextMilestoneForUserClub(
          user.id,
          club.id,
          retryCommandId
        )
      ]);

      expect(
        duplicateResults.map((result) => result.currentMilestone?.position)
      ).toEqual([1, 1]);
      expect(
        await prisma.progressHistory.count({
          where: {
            userId: user.id,
            clubId: club.id
          }
        })
      ).toBe(1);

      await progressRepository.advanceProgressToNextMilestoneForUserClub(
        user.id,
        club.id,
        crypto.randomUUID()
      );

      const progress = await prisma.clubProgress.findUniqueOrThrow({
        where: {
          userId_clubId: {
            userId: user.id,
            clubId: club.id
          }
        },
        select: {
          version: true,
          currentMilestone: {
            select: {
              position: true
            }
          }
        }
      });
      const history = await prisma.progressHistory.findMany({
        where: {
          userId: user.id,
          clubId: club.id
        },
        orderBy: {
          version: "asc"
        },
        select: {
          version: true,
          fromMilestone: {
            select: {
              position: true
            }
          },
          toMilestone: {
            select: {
              position: true
            }
          }
        }
      });

      expect(progress).toEqual({
        version: 2,
        currentMilestone: {
          position: 2
        }
      });
      expect(history).toEqual([
        {
          version: 1,
          fromMilestone: null,
          toMilestone: {
            position: 1
          }
        },
        {
          version: 2,
          fromMilestone: {
            position: 1
          },
          toMilestone: {
            position: 2
          }
        }
      ]);
    } finally {
      if (clubId) {
        await prisma.club.deleteMany({
          where: {
            id: clubId
          }
        });
      }
      if (userId) {
        await prisma.user.deleteMany({
          where: {
            id: userId
          }
        });
      }
    }
  }, 20_000);
});
