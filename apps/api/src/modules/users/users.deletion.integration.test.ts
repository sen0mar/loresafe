import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { hashPassword } from "../../core/security/password.js";
import { usersRepository } from "./users.repository.js";
import { usersService } from "./users.service.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("account deletion reauthentication", () => {
  it("denies wrong or stale credentials before deleting with the current password", async () => {
    const suffix = crypto.randomUUID();
    const password = "correct horse battery staple";
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `account-delete-${suffix}@example.com`,
          displayName: `delete-${suffix}`.slice(0, 80),
          username: `delete_${suffix}`.slice(0, 30),
          passwordHash: await hashPassword(password),
          sessionVersion: 7
        },
        select: {
          id: true
        }
      });
      userId = user.id;

      await expect(
        usersService.deleteCurrentUserAccount(user.id, {
          confirmation: "delete",
          password: "wrong password"
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Invalid credentials"
      });
      await expect(
        usersRepository.deleteCurrentUserAccount(user.id, 6)
      ).resolves.toBe("REAUTH_REQUIRED");
      expect(
        await prisma.user.findUnique({
          where: {
            id: user.id
          },
          select: {
            sessionVersion: true
          }
        })
      ).toEqual({
        sessionVersion: 7
      });

      await expect(
        usersService.deleteCurrentUserAccount(user.id, {
          confirmation: "delete",
          password
        })
      ).resolves.toBeUndefined();
      expect(
        await prisma.user.findUnique({
          where: {
            id: user.id
          }
        })
      ).toBeNull();
      userId = null;
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
