import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { hashPassword } from "../../core/security/password.js";
import { notificationsRepository } from "../notifications/notifications.repository.js";
import { authService, RefreshTokenReuseError } from "./auth.service.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("refresh token replay containment", () => {
  it("tolerates one parallel retry, then revokes and records a reused family", async () => {
    const suffix = crypto.randomUUID();
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `refresh-reuse-${suffix}@example.com`,
          displayName: `refresh-${suffix}`.slice(0, 80),
          username: `refresh_${suffix}`.slice(0, 30),
          passwordHash: await hashPassword("correct horse battery staple"),
          emailVerifiedAt: new Date()
        },
        select: {
          id: true
        }
      });
      userId = user.id;
      const login = await authService.login({
        email: `refresh-reuse-${suffix}@example.com`,
        password: "correct horse battery staple"
      });
      const concurrentResults = await Promise.allSettled([
        authService.refresh(login.refreshToken),
        authService.refresh(login.refreshToken)
      ]);
      const successfulRotation = concurrentResults.find(
        (result) => result.status === "fulfilled"
      );

      expect(successfulRotation?.status).toBe("fulfilled");
      expect(
        concurrentResults.filter((result) => result.status === "rejected")
      ).toHaveLength(1);

      const session = await prisma.authSession.findFirstOrThrow({
        where: {
          userId: user.id
        },
        select: {
          tokenFamilyId: true,
          generation: true,
          revokedAt: true
        }
      });
      expect(session).toMatchObject({
        generation: 2,
        revokedAt: null
      });
      expect(
        await prisma.securityEvent.count({
          where: {
            userId: user.id
          }
        })
      ).toBe(0);

      await prisma.authRefreshTokenTombstone.update({
        where: {
          tokenHash: (
            await prisma.authRefreshTokenTombstone.findFirstOrThrow({
              where: {
                userId: user.id
              },
              select: {
                tokenHash: true
              }
            })
          ).tokenHash
        },
        data: {
          graceUntil: new Date(Date.now() - 1)
        }
      });

      await expect(
        authService.refresh(login.refreshToken)
      ).rejects.toBeInstanceOf(RefreshTokenReuseError);
      await expect(
        prisma.authSession.findFirstOrThrow({
          where: {
            userId: user.id
          },
          select: {
            revokedAt: true
          }
        })
      ).resolves.toMatchObject({
        revokedAt: expect.any(Date)
      });
      await expect(
        prisma.securityEvent.count({
          where: {
            userId: user.id,
            familyId: session.tokenFamilyId,
            type: "REFRESH_TOKEN_REUSE"
          }
        })
      ).resolves.toBe(1);
      await expect(
        prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: "SECURITY_ALERT"
          },
          select: {
            clubId: true,
            requiredMilestoneId: true,
            safeText: true
          }
        })
      ).resolves.toEqual({
        clubId: null,
        requiredMilestoneId: null,
        safeText:
          "We blocked reuse of an old sign-in token and signed out that device session."
      });
      await expect(
        notificationsRepository.listNotificationsForUser(user.id, {
          cursor: null,
          limit: 10
        })
      ).resolves.toMatchObject({
        unreadCount: 1,
        notifications: [
          {
            type: "SECURITY_ALERT",
            club: null,
            requiredMilestone: null,
            progress: null
          }
        ]
      });

      if (successfulRotation?.status === "fulfilled") {
        await expect(
          authService.refresh(successfulRotation.value.refreshToken)
        ).rejects.toMatchObject({
          statusCode: 401
        });
      }
    } finally {
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
