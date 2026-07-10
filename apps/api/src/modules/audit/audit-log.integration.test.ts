import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { createAuditLogInTransaction } from "./audit-log.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("audit log retention", () => {
  it("keeps immutable actor and club attribution after their records are deleted", async () => {
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

      await prisma.user.delete({
        where: {
          id: user.id
        }
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
            actorUsername: true
          }
        })
      ).resolves.toEqual({
        actorId: null,
        actorDisplayName,
        actorUsername
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
});
