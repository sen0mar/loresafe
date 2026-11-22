import { prisma } from "../../core/prisma/client.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  createUserWithReservations,
  isUniqueConstraintError,
  type AuthUsersRepository
} from "./auth.repository.js";

export type SavePendingSignupInput = {
  email: string;
  username: string;
  passwordHash: string;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
};

export type CompletePendingSignupResult =
  | { status: "CREATED"; userId: string }
  | { status: "EMAIL_TAKEN" }
  | { status: "USERNAME_TAKEN" }
  | { status: "INVALID" };

export type PendingSignupRepository = {
  // One pending signup per email: a newer signup replaces the older one and
  // invalidates its link. Pending rows never reserve a username.
  savePendingSignup: (input: SavePendingSignupInput) => Promise<void>;
  // Returns false when no live pending signup exists for the email.
  rotatePendingSignupToken: (input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }) => Promise<boolean>;
  // Consumes the link and, when the email and username are still free,
  // creates the verified account in the same transaction.
  completePendingSignup: (input: {
    tokenHash: string;
    now: Date;
  }) => Promise<CompletePendingSignupResult>;
};

// Bounded, request-driven retention: no timer or cron touches PostgreSQL.
export const expiredPendingSignupPurgeLimit = 100;

type PendingSignupRow = {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  expires_at: Date;
};

const purgeExpiredPendingSignups = (
  transaction: Prisma.TransactionClient,
  now: Date
) =>
  transaction.$executeRaw`
    DELETE FROM "pending_signups"
    WHERE "id" IN (
      SELECT "id"
      FROM "pending_signups"
      WHERE "expires_at" <= ${now}
      ORDER BY "expires_at"
      LIMIT ${expiredPendingSignupPurgeLimit}
    )
  `;

const findOwnerConflict = async (
  transaction: Prisma.TransactionClient | typeof prisma,
  { email, username }: { email: string; username: string }
): Promise<CompletePendingSignupResult | null> => {
  // A taken name wins over a taken email, matching signup's public responses.
  const reservation = await transaction.userNameReservation.findFirst({
    where: {
      normalizedName: normalizeNameReservationKey(username),
      user: { deletedAt: null }
    },
    select: { userId: true }
  });

  if (reservation) {
    return { status: "USERNAME_TAKEN" };
  }

  const emailOwner = await transaction.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true }
  });

  return emailOwner ? { status: "EMAIL_TAKEN" } : null;
};

export const pendingSignupRepository: PendingSignupRepository = {
  savePendingSignup: ({
    email,
    username,
    passwordHash,
    tokenHash,
    expiresAt,
    now
  }) =>
    prisma.$transaction(async (transaction) => {
      await purgeExpiredPendingSignups(transaction, now);
      await transaction.pendingSignup.upsert({
        where: { email },
        create: { email, username, passwordHash, tokenHash, expiresAt },
        update: {
          username,
          passwordHash,
          tokenHash,
          expiresAt,
          createdAt: now
        },
        select: { id: true }
      });
    }),

  rotatePendingSignupToken: async ({ email, tokenHash, expiresAt, now }) => {
    const rotated = await prisma.pendingSignup.updateMany({
      where: { email, expiresAt: { gt: now } },
      data: { tokenHash, expiresAt }
    });

    return rotated.count === 1;
  },

  completePendingSignup: async ({ tokenHash, now }) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        // The row lock serializes double clicks: the second waits, then finds
        // the row gone and reports an invalid link.
        const [pending] = await transaction.$queryRaw<PendingSignupRow[]>`
          SELECT "id", "email", "username", "password_hash", "expires_at"
          FROM "pending_signups"
          WHERE "token_hash" = ${tokenHash}
          FOR UPDATE
        `;

        if (!pending) {
          return { status: "INVALID" } as const;
        }

        await transaction.pendingSignup.delete({
          where: { id: pending.id },
          select: { id: true }
        });

        if (pending.expires_at <= now) {
          return { status: "INVALID" } as const;
        }

        const conflict = await findOwnerConflict(transaction, pending);

        if (conflict) {
          return conflict;
        }

        const user = await createUserWithReservations(transaction, {
          email: pending.email,
          displayName: pending.username,
          username: pending.username,
          passwordHash: pending.password_hash,
          emailVerifiedAt: now
        });

        return { status: "CREATED", userId: user.id } as const;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      // A concurrent confirmation committed the same email or name first. The
      // transaction rolled back, so consume this link explicitly.
      const pending = await prisma.pendingSignup.findUnique({
        where: { tokenHash },
        select: { email: true, username: true }
      });

      if (!pending) {
        return { status: "INVALID" };
      }

      await prisma.pendingSignup.deleteMany({ where: { tokenHash } });

      return (
        (await findOwnerConflict(prisma, pending)) ?? {
          status: "USERNAME_TAKEN"
        }
      );
    }
  }
};

// Test double that creates accounts through the supplied users repository.
export const createMemoryPendingSignupRepository = (
  usersRepository: AuthUsersRepository
): PendingSignupRepository => {
  const pendingByEmail = new Map<string, Omit<SavePendingSignupInput, "now">>();

  const findByTokenHash = (tokenHash: string) => {
    for (const pending of pendingByEmail.values()) {
      if (pending.tokenHash === tokenHash) {
        return pending;
      }
    }

    return null;
  };

  return {
    savePendingSignup: async ({ now, ...pending }) => {
      for (const [email, existing] of pendingByEmail.entries()) {
        if (existing.expiresAt <= now) {
          pendingByEmail.delete(email);
        }
      }
      pendingByEmail.set(pending.email, pending);
    },

    rotatePendingSignupToken: async ({ email, tokenHash, expiresAt, now }) => {
      const pending = pendingByEmail.get(email);

      if (!pending || pending.expiresAt <= now) {
        return false;
      }

      pending.tokenHash = tokenHash;
      pending.expiresAt = expiresAt;
      return true;
    },

    completePendingSignup: async ({ tokenHash, now }) => {
      const pending = findByTokenHash(tokenHash);

      if (!pending) {
        return { status: "INVALID" };
      }

      pendingByEmail.delete(pending.email);

      if (pending.expiresAt <= now) {
        return { status: "INVALID" };
      }

      if (
        await usersRepository.findActiveUserByReservedName?.(
          normalizeNameReservationKey(pending.username)
        )
      ) {
        return { status: "USERNAME_TAKEN" };
      }

      if (await usersRepository.findActiveUserByEmail(pending.email)) {
        return { status: "EMAIL_TAKEN" };
      }

      const user = await usersRepository.createUser({
        email: pending.email,
        displayName: pending.username,
        username: pending.username,
        passwordHash: pending.passwordHash,
        emailVerifiedAt: now
      });

      return { status: "CREATED", userId: user.id };
    }
  };
};
