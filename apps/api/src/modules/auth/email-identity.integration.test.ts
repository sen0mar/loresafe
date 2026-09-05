import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../core/security/password.js";
import { prisma } from "../../core/prisma/client.js";
import { emailIdentityRepository } from "./email-identity.repository.js";
import { hashEmailIdentityToken } from "./email-identity-token.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("email identity lifecycle", () => {
  it.each([
    { purpose: "VERIFY_EMAIL", consumed: false },
    { purpose: "VERIFY_EMAIL", consumed: true },
    { purpose: "RESET_PASSWORD", consumed: false },
    { purpose: "RESET_PASSWORD", consumed: true }
  ] as const)(
    "rejects cross-purpose $purpose tokens with consumed=$consumed without mutations",
    async ({ purpose, consumed }) => {
      const user = await createUserFixture("token-purpose", null);
      const tokenHash = hashEmailIdentityToken(crypto.randomUUID());
      const now = new Date();
      const consumeForPurpose = () =>
        purpose === "VERIFY_EMAIL"
          ? emailIdentityRepository.consumeVerificationToken(tokenHash, now)
          : emailIdentityRepository.consumePasswordResetToken({
              tokenHash,
              passwordHash: "first-reset-fixture",
              now
            });
      const readState = () =>
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            passwordHash: true,
            emailVerifiedAt: true,
            sessionVersion: true,
            authSessions: { select: { revokedAt: true } },
            emailIdentityTokens: { select: { consumedAt: true } }
          }
        });

      try {
        await emailIdentityRepository.issueToken({
          userId: user.id,
          purpose,
          tokenHash,
          expiresAt: new Date(now.getTime() + 60_000)
        });
        if (consumed) {
          expect(await consumeForPurpose()).toEqual({
            status: "SUCCESS",
            userId: user.id
          });
        }
        await prisma.authSession.create({
          data: {
            ...sessionFixture(user.id, "1"),
            sessionIdHash: hashEmailIdentityToken(crypto.randomUUID()),
            refreshTokenHash: hashEmailIdentityToken(crypto.randomUUID())
          }
        });
        const before = await readState();
        const result =
          purpose === "VERIFY_EMAIL"
            ? await emailIdentityRepository.consumePasswordResetToken({
                tokenHash,
                passwordHash: "wrong-purpose-reset-fixture",
                now
              })
            : await emailIdentityRepository.consumeVerificationToken(
                tokenHash,
                now
              );

        expect(result).toEqual({ status: "INVALID" });
        expect(await readState()).toEqual(before);
        expect(await consumeForPurpose()).toEqual({
          status: consumed ? "ALREADY_CONSUMED" : "SUCCESS",
          userId: user.id
        });
        const afterConsumption = await readState();
        expect(await consumeForPurpose()).toEqual({
          status: "ALREADY_CONSUMED",
          userId: user.id
        });
        expect(await readState()).toEqual(afterConsumption);
        if (consumed) {
          expect(afterConsumption).toEqual(before);
        }
      } finally {
        await prisma.user.deleteMany({ where: { id: user.id } });
      }
    }
  );

  it("consumes verification tokens once and treats concurrent replay idempotently", async () => {
    const user = await createUserFixture("verification", null);
    const tokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const now = new Date();

    try {
      await emailIdentityRepository.issueToken({
        userId: user.id,
        purpose: "VERIFY_EMAIL",
        tokenHash,
        expiresAt: new Date(now.getTime() + 60_000)
      });

      const results = await Promise.all([
        emailIdentityRepository.consumeVerificationToken(tokenHash, new Date()),
        emailIdentityRepository.consumeVerificationToken(tokenHash, new Date())
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        "ALREADY_CONSUMED",
        "SUCCESS"
      ]);
      expect(
        await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { emailVerifiedAt: true }
        })
      ).toEqual({
        emailVerifiedAt: expect.any(Date)
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it("invalidates superseded links without treating them as completed replays", async () => {
    const user = await createUserFixture("superseded", null);
    const firstTokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const secondTokenHash = hashEmailIdentityToken(crypto.randomUUID());
    const expiresAt = new Date(Date.now() + 60_000);

    try {
      await Promise.all([
        emailIdentityRepository.issueToken({
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          tokenHash: firstTokenHash,
          expiresAt
        }),
        emailIdentityRepository.issueToken({
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          tokenHash: secondTokenHash,
          expiresAt
        })
      ]);

      const results = await Promise.all([
        emailIdentityRepository.consumeVerificationToken(
          firstTokenHash,
          new Date()
        ),
        emailIdentityRepository.consumeVerificationToken(
          secondTokenHash,
          new Date()
        )
      ]);

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
