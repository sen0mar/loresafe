import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../core/security/password.js";
import { prisma } from "../../core/prisma/client.js";
import { emailIdentityRepository } from "./email-identity.repository.js";
import { hashEmailIdentityToken } from "./email-identity-token.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("email identity lifecycle", () => {
  it("rejects legacy verification rows as password reset links without mutations", async () => {
    const user = await createUserFixture("token-purpose", new Date());
    const tokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const readState = () =>
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          passwordHash: true,
          sessionVersion: true,
          emailIdentityTokens: { select: { consumedAt: true } }
        }
      });

    try {
      // Rows like this predate pending signups; they must never act as a reset.
      await prisma.emailIdentityToken.create({
        data: {
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          tokenHash,
          expiresAt: new Date(Date.now() + 60_000)
        }
      });
      const before = await readState();

      expect(
        await emailIdentityRepository.consumePasswordResetToken({
          tokenHash,
          passwordHash: "wrong-purpose-reset-fixture",
          now: new Date()
        })
      ).toEqual({ status: "INVALID" });
      expect(await readState()).toEqual(before);
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it("invalidates superseded reset links without treating them as completed replays", async () => {
    const user = await createUserFixture("superseded", new Date());
    const firstTokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const secondTokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const expiresAt = new Date(Date.now() + 60_000);

    try {
      await Promise.all([
        emailIdentityRepository.issueToken({
          userId: user.id,
          purpose: "RESET_PASSWORD",
          tokenHash: firstTokenHash,
          expiresAt
        }),
        emailIdentityRepository.issueToken({
          userId: user.id,
          purpose: "RESET_PASSWORD",
          tokenHash: secondTokenHash,
          expiresAt
        })
      ]);

      const results = await Promise.all(
        [firstTokenHash, secondTokenHash].map((tokenHash) =>
          emailIdentityRepository.consumePasswordResetToken({
            tokenHash,
            passwordHash: "superseded-reset-fixture",
            now: new Date()
          })
        )
      );

      expect(results.map((result) => result.status).sort()).toEqual([
        "INVALID",
        "SUCCESS"
      ]);
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it("changes the password once and revokes every session atomically", async () => {
    const oldPassword = "old correct horse battery staple";
    const firstNewPassword = "first new correct horse battery staple";
    const replayPassword = "replayed correct horse battery staple";
    const user = await createUserFixture(
      "password-reset",
      new Date(),
      await hashPassword(oldPassword)
    );
    const tokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const now = new Date();

    try {
      await prisma.authSession.createMany({
        data: [sessionFixture(user.id, "1"), sessionFixture(user.id, "2")]
      });
      await emailIdentityRepository.issueToken({
        userId: user.id,
        purpose: "RESET_PASSWORD",
        tokenHash,
        expiresAt: new Date(now.getTime() + 60_000)
      });

      const first = await emailIdentityRepository.consumePasswordResetToken({
        tokenHash,
        passwordHash: await hashPassword(firstNewPassword),
        now: new Date()
      });
      const replay = await emailIdentityRepository.consumePasswordResetToken({
        tokenHash,
        passwordHash: await hashPassword(replayPassword),
        now: new Date()
      });
      const storedUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          passwordHash: true,
          sessionVersion: true,
          authSessions: { select: { revokedAt: true } }
        }
      });

      expect(first.status).toBe("SUCCESS");
      expect(replay.status).toBe("ALREADY_CONSUMED");
      expect(storedUser.sessionVersion).toBe(2);
      expect(storedUser.authSessions).toEqual([
        { revokedAt: expect.any(Date) },
        { revokedAt: expect.any(Date) }
      ]);
      await expect(
        verifyPassword(storedUser.passwordHash, firstNewPassword)
      ).resolves.toBe(true);
      await expect(
        verifyPassword(storedUser.passwordHash, replayPassword)
      ).resolves.toBe(false);
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});

const createUserFixture = async (
  label: string,
  emailVerifiedAt: Date | null,
  passwordHash = "$argon2id$v=19$integration-fixture"
) => {
  const suffix = crypto.randomUUID();

  return prisma.user.create({
    data: {
      email: `${label}-${suffix}@example.com`,
      displayName: `${label}-${suffix}`.slice(0, 80),
      username: `${label}_${suffix}`.slice(0, 30),
      passwordHash,
      emailVerifiedAt
    },
    select: { id: true }
  });
};

const sessionFixture = (userId: string, suffix: string) => ({
  userId,
  sessionIdHash: suffix.repeat(64),
  refreshTokenHash: String(Number(suffix) + 2).repeat(64),
  sessionVersion: 1,
  expiresAt: new Date(Date.now() + 60_000)
});
