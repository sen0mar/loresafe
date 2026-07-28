import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import {
  anonymizeDeletedUserAuditLogsInTransaction,
  auditLogCleanupBatchSize,
  createAuditLogInTransaction,
  deletedActorDisplayName,
  deletedActorUsername,
  purgeExpiredAuditLogsInTransaction
} from "./audit-log.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("audit log retention", () => {
  it("anonymizes deleted actors while preserving the moderated club snapshot", async () => {
    const suffix = crypto.randomUUID();
    const actorDisplayName = `Audit actor ${suffix}`.slice(0, 80);
    const actorUsername = `audit_${suffix}`.slice(0, 30);
    const clubTitle = `Audit club ${suffix}`.slice(0, 120);
    const clubLinkName = `audit-club-${suffix}`.slice(0, 80);
    let auditLogId: string | null = null;
    let clubId: string | null = null;
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `audit-${suffix}@example.com`,
          displayName: actorDisplayName,
          username: actorUsername,
          passwordHash: "$argon2id$v=19$integration-fixture"
        },
        select: {
          id: true
        }
      });
      userId = user.id;
      const club = await prisma.club.create({
        data: {
          title: clubTitle,
          linkName: clubLinkName,
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER"
            }
          }
        },
        select: {
          id: true
        }
      });
      clubId = club.id;
      const auditLog = await prisma.$transaction((transaction) =>
        createAuditLogInTransaction(transaction, {
          action: "USER_WARNED",
          actorId: user.id,
          clubId: club.id,
          targetUserId: user.id,
          metadata: {
            source: "INTEGRATION_TEST"
          }
        })
      );
      auditLogId = auditLog.id;

      await prisma.$transaction(async (transaction) => {
        await anonymizeDeletedUserAuditLogsInTransaction(transaction, user.id);
        await transaction.user.delete({
          where: {
            id: user.id
          }
        });
      });
      userId = null;

      await expect(
        prisma.auditLog.findUniqueOrThrow({
          where: {
            id: auditLog.id
          },
          select: {
            actorId: true,
            actorDisplayName: true,
            actorUsername: true,
            actorAnonymizedAt: true
          }
        })
      ).resolves.toEqual({
        actorId: null,
        actorDisplayName: deletedActorDisplayName,
        actorUsername: deletedActorUsername,
        actorAnonymizedAt: expect.any(Date)
      });

      await prisma.club.delete({
        where: {
          id: club.id
        }
      });
      clubId = null;

      await expect(
        prisma.auditLog.findUniqueOrThrow({
          where: {
            id: auditLog.id
          },
          select: {
            clubId: true,
            clubTitle: true,
            clubLinkName: true
          }
        })
      ).resolves.toEqual({
        clubId: null,
        clubTitle,
        clubLinkName
      });
    } finally {
      if (auditLogId) {
        await prisma.auditLog.deleteMany({
          where: {
            id: auditLogId
          }
        });
      }
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
  });

  it("purges no more than the bounded batch of expired records per request", async () => {
    const suffix = crypto.randomUUID();
    let clubId: string | null = null;
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `audit-purge-${suffix}@example.com`,
          displayName: `Purge ${suffix}`.slice(0, 80),
          username: `purge_${suffix}`.slice(0, 30),
          passwordHash: "$argon2id$v=19$integration-fixture"
        },
        select: {
          id: true,
          displayName: true,
          username: true
        }
      });
      userId = user.id;
      const club = await prisma.club.create({
        data: {
          title: `Purge club ${suffix}`.slice(0, 120),
          linkName: `purge-club-${suffix}`.slice(0, 80),
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER"
            }
          }
        },
        select: {
          id: true,
          title: true,
          linkName: true
        }
      });
      clubId = club.id;
      const createdAt = new Date("2024-01-01T00:00:00.000Z");

      await prisma.auditLog.createMany({
        data: Array.from({ length: auditLogCleanupBatchSize + 1 }, () => ({
          action: "USER_WARNED" as const,
          actorId: user.id,
          actorDisplayName: user.displayName,
          actorUsername: user.username,
          clubId: club.id,
          clubTitle: club.title,
          clubLinkName: club.linkName,
          metadata: {
            source: "RETENTION_TEST"
          },
          createdAt
        }))
      });

      await prisma.$transaction((transaction) =>
        purgeExpiredAuditLogsInTransaction(
          transaction,
          new Date("2026-07-28T00:00:00.000Z")
        )
      );

      expect(
        await prisma.auditLog.count({
          where: {
            clubId: club.id,
            createdAt
          }
        })
      ).toBe(1);
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
  });
});
