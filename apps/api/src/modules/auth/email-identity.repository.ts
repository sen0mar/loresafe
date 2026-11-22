import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { EmailIdentityTokenPurpose } from "./email-identity-token.js";

export type EmailIdentityTokenRecord = {
  userId: string;
  email: string;
  emailVerifiedAt: Date | null;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type ConsumeEmailTokenResult =
  | { status: "SUCCESS"; userId: string }
  | { status: "ALREADY_CONSUMED"; userId: string }
  | { status: "INVALID" };

export type EmailIdentityRepository = {
  issueToken: (input: {
    userId: string;
    purpose: EmailIdentityTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  consumePasswordResetToken: (input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }) => Promise<ConsumeEmailTokenResult>;
};

const findToken = (
  transaction: Prisma.TransactionClient,
  tokenHash: string,
  purpose: EmailIdentityTokenPurpose
) =>
  transaction.emailIdentityToken.findUnique({
    where: { tokenHash, purpose },
    select: {
      userId: true,
      expiresAt: true,
      consumedAt: true
    }
  });

export const emailIdentityRepository: EmailIdentityRepository = {
  issueToken: ({ userId, purpose, tokenHash, expiresAt }) =>
    prisma.$transaction(async (transaction) => {
      const users = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "users"
        WHERE "id" = ${userId}::uuid
        FOR UPDATE
      `;

      if (users.length !== 1) {
        return;
      }

      await transaction.emailIdentityToken.deleteMany({
        where: {
          userId,
          purpose,
          consumedAt: null
        }
      });
      await transaction.emailIdentityToken.create({
        data: {
          userId,
          purpose,
          tokenHash,
          expiresAt
        },
        select: { id: true }
      });
    }),

  consumePasswordResetToken: ({ tokenHash, passwordHash, now }) =>
    prisma.$transaction(async (transaction) => {
      const token = await findToken(transaction, tokenHash, "RESET_PASSWORD");

      if (!token || token.expiresAt <= now) {
        return { status: "INVALID" };
      }

      if (token.consumedAt) {
        return { status: "ALREADY_CONSUMED", userId: token.userId };
      }

      const consumed = await transaction.emailIdentityToken.updateMany({
        where: {
          tokenHash,
          purpose: "RESET_PASSWORD",
          consumedAt: null,
          expiresAt: { gt: now }
        },
        data: { consumedAt: now }
      });

      if (consumed.count !== 1) {
        const replay = await findToken(
          transaction,
          tokenHash,
          "RESET_PASSWORD"
        );

        return replay?.consumedAt
          ? { status: "ALREADY_CONSUMED", userId: replay.userId }
          : { status: "INVALID" };
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 }
        },
        select: { id: true }
      });
      await transaction.authSession.updateMany({
        where: {
          userId: token.userId,
          revokedAt: null
        },
        data: { revokedAt: now }
      });

      return { status: "SUCCESS", userId: token.userId };
    })
};

export const createMemoryEmailIdentityRepository =
  (): EmailIdentityRepository => {
    const tokens = new Map<
      string,
      {
        userId: string;
        purpose: EmailIdentityTokenPurpose;
        expiresAt: Date;
        consumedAt: Date | null;
      }
    >();

    const consume = (
      tokenHash: string,
      purpose: EmailIdentityTokenPurpose,
      now: Date
    ): ConsumeEmailTokenResult => {
      const token = tokens.get(tokenHash);

      if (!token || token.purpose !== purpose || token.expiresAt <= now) {
        return { status: "INVALID" };
      }

      if (token.consumedAt) {
        return { status: "ALREADY_CONSUMED", userId: token.userId };
      }

      token.consumedAt = now;
      return { status: "SUCCESS", userId: token.userId };
    };

    return {
      issueToken: async ({ userId, purpose, tokenHash, expiresAt }) => {
        for (const [existingTokenHash, token] of tokens.entries()) {
          if (
            token.userId === userId &&
            token.purpose === purpose &&
            !token.consumedAt
          ) {
            tokens.delete(existingTokenHash);
          }
        }
        tokens.set(tokenHash, {
          userId,
          purpose,
          expiresAt,
          consumedAt: null
        });
      },
      consumePasswordResetToken: async ({ tokenHash, now }) =>
        consume(tokenHash, "RESET_PASSWORD", now)
    };
  };
