import { randomUUID } from "node:crypto";

import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";

export type AuthSessionRecord = {
  userId: string;
  tokenFamilyId: string;
  generation: number;
  sessionIdHash: string;
  refreshTokenHash: string;
  sessionVersion: number;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type CreateAuthSessionInput = Omit<
  AuthSessionRecord,
  "tokenFamilyId" | "generation" | "revokedAt"
>;

export type RefreshRotationResult =
  | { status: "ROTATED"; session: AuthSessionRecord }
  | { status: "GRACE_REUSE"; userId: string; familyId: string }
  | { status: "COMPROMISED"; userId: string; familyId: string }
  | { status: "INVALID" };

export type AuthSessionsRepository = {
  createSession: (input: CreateAuthSessionInput) => Promise<AuthSessionRecord>;
  findActiveBySessionIdHash: (
    sessionIdHash: string,
    now: Date
  ) => Promise<AuthSessionRecord | null>;
  hasSessionIdHash: (sessionIdHash: string) => Promise<boolean>;
  rotateOrDetectRefreshReuse: (input: {
    currentRefreshTokenHash: string;
    nextSessionIdHash: string;
    nextRefreshTokenHash: string;
    now: Date;
    graceUntil: Date;
    tombstoneExpiresAt: Date;
  }) => Promise<RefreshRotationResult>;
  revokeSession: (
    identifiers: { sessionIdHash?: string; refreshTokenHash?: string },
    now: Date
  ) => Promise<string | null>;
  revokeAllSessions: (userId: string, now: Date) => Promise<number>;
};

const sessionSelect = {
  userId: true,
  tokenFamilyId: true,
  generation: true,
  sessionIdHash: true,
  refreshTokenHash: true,
  sessionVersion: true,
  expiresAt: true,
  revokedAt: true
} as const;

/* v8 ignore start -- exercised by the real PostgreSQL integration suite */
export const authSessionsRepository: AuthSessionsRepository = {
  createSession: (input) =>
    prisma.authSession.create({
      data: input,
      select: sessionSelect
    }),

  findActiveBySessionIdHash: (sessionIdHash, now) =>
    prisma.authSession.findFirst({
      where: {
        sessionIdHash,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      select: sessionSelect
    }),

  hasSessionIdHash: async (sessionIdHash) =>
    (await prisma.authSession.count({ where: { sessionIdHash } })) > 0,

  rotateOrDetectRefreshReuse: ({
    currentRefreshTokenHash,
    nextSessionIdHash,
    nextRefreshTokenHash,
    now,
    graceUntil,
    tombstoneExpiresAt
  }) =>
    prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${currentRefreshTokenHash}, 0))
      `;
      await purgeExpiredRefreshTombstones(transaction, now);

      const session = await transaction.authSession.findFirst({
        where: {
          refreshTokenHash: currentRefreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        select: sessionSelect
      });

      if (session) {
        const rotated = await transaction.authSession.updateMany({
          where: {
            sessionIdHash: session.sessionIdHash,
            refreshTokenHash: currentRefreshTokenHash,
            generation: session.generation,
            revokedAt: null,
            expiresAt: { gt: now }
          },
          data: {
            sessionIdHash: nextSessionIdHash,
            refreshTokenHash: nextRefreshTokenHash,
            generation: {
              increment: 1
            },
            lastUsedAt: now
          }
        });

        if (rotated.count !== 1) {
          return { status: "INVALID" };
        }

        await transaction.authRefreshTokenTombstone.create({
          data: {
            userId: session.userId,
            familyId: session.tokenFamilyId,
            generation: session.generation,
            tokenHash: currentRefreshTokenHash,
            spentAt: now,
            graceUntil,
            expiresAt: tombstoneExpiresAt
          }
        });

        return {
          status: "ROTATED",
          session: {
            ...session,
            sessionIdHash: nextSessionIdHash,
            refreshTokenHash: nextRefreshTokenHash,
            generation: session.generation + 1
          }
        };
      }

      const tombstone = await transaction.authRefreshTokenTombstone.findUnique({
        where: {
          tokenHash: currentRefreshTokenHash
        },
        select: {
          userId: true,
          familyId: true,
          graceUntil: true,
          expiresAt: true
        }
      });

      if (!tombstone || tombstone.expiresAt <= now) {
        return { status: "INVALID" };
      }

      if (now <= tombstone.graceUntil) {
        return {
          status: "GRACE_REUSE",
          userId: tombstone.userId,
          familyId: tombstone.familyId
        };
      }

      await transaction.authSession.updateMany({
        where: {
          tokenFamilyId: tombstone.familyId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });
      await transaction.securityEvent.upsert({
        where: {
          familyId_type: {
            familyId: tombstone.familyId,
            type: "REFRESH_TOKEN_REUSE"
          }
        },
        create: {
          userId: tombstone.userId,
          familyId: tombstone.familyId,
          type: "REFRESH_TOKEN_REUSE",
          createdAt: now
        },
        update: {}
      });
      await transaction.notification.upsert({
        where: {
          eventKey: `security-refresh-reuse:${tombstone.familyId}`
        },
        create: {
          userId: tombstone.userId,
          type: "SECURITY_ALERT",
          eventKey: `security-refresh-reuse:${tombstone.familyId}`,
          safeText:
            "We blocked reuse of an old sign-in token and signed out that device session."
        },
        update: {}
      });

      return {
        status: "COMPROMISED",
        userId: tombstone.userId,
        familyId: tombstone.familyId
      };
    }),

  revokeSession: async (identifiers, now) => {
    const session = await prisma.authSession.findFirst({
      where: {
        revokedAt: null,
        OR: [
          ...(identifiers.sessionIdHash
            ? [{ sessionIdHash: identifiers.sessionIdHash }]
            : []),
          ...(identifiers.refreshTokenHash
            ? [{ refreshTokenHash: identifiers.refreshTokenHash }]
            : [])
        ]
      },
      select: {
        id: true,
        userId: true
      }
    });

    if (!session) {
      return null;
    }

    await prisma.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    return session.userId;
  },

  revokeAllSessions: async (userId, now) => {
    const result = await prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    return result.count;
  }
};
/* v8 ignore stop */

export const createMemoryAuthSessionsRepository =
  (): AuthSessionsRepository => {
    const sessions = new Map<string, AuthSessionRecord>();
    const knownSessionIdHashes = new Set<string>();
    const tombstones = new Map<
      string,
      {
        userId: string;
        familyId: string;
        graceUntil: Date;
        expiresAt: Date;
      }
    >();

    const findActive = (session: AuthSessionRecord | undefined, now: Date) =>
      session && !session.revokedAt && session.expiresAt > now ? session : null;

    return {
      createSession: async (input) => {
        const session = {
          ...input,
          tokenFamilyId: randomUUID(),
          generation: 1,
          revokedAt: null
        };
        sessions.set(input.sessionIdHash, session);
        knownSessionIdHashes.add(input.sessionIdHash);
        return session;
      },
      findActiveBySessionIdHash: async (sessionIdHash, now) =>
        findActive(sessions.get(sessionIdHash), now),
      hasSessionIdHash: async (sessionIdHash) =>
        knownSessionIdHashes.has(sessionIdHash),
      rotateOrDetectRefreshReuse: async ({
        currentRefreshTokenHash,
        nextSessionIdHash,
        nextRefreshTokenHash,
        now,
        graceUntil,
        tombstoneExpiresAt
      }) => {
        const session = findActive(
          [...sessions.values()].find(
            (candidate) =>
              candidate.refreshTokenHash === currentRefreshTokenHash
          ),
          now
        );

        if (!session) {
          const tombstone = tombstones.get(currentRefreshTokenHash);

          if (!tombstone || tombstone.expiresAt <= now) {
            return { status: "INVALID" };
          }

          if (now <= tombstone.graceUntil) {
            return {
              status: "GRACE_REUSE",
              userId: tombstone.userId,
              familyId: tombstone.familyId
            };
          }

          for (const candidate of sessions.values()) {
            if (
              candidate.tokenFamilyId === tombstone.familyId &&
              !candidate.revokedAt
            ) {
              candidate.revokedAt = now;
            }
          }

          return {
            status: "COMPROMISED",
            userId: tombstone.userId,
            familyId: tombstone.familyId
          };
        }

        tombstones.set(currentRefreshTokenHash, {
          userId: session.userId,
          familyId: session.tokenFamilyId,
          graceUntil,
          expiresAt: tombstoneExpiresAt
        });
        session.refreshTokenHash = nextRefreshTokenHash;
        sessions.delete(session.sessionIdHash);
        session.sessionIdHash = nextSessionIdHash;
        session.generation += 1;
        sessions.set(nextSessionIdHash, session);
        knownSessionIdHashes.add(nextSessionIdHash);
        return {
          status: "ROTATED",
          session
        };
      },
      revokeSession: async (identifiers, now) => {
        const session = [...sessions.values()].find(
          (candidate) =>
            (!candidate.revokedAt &&
              identifiers.sessionIdHash === candidate.sessionIdHash) ||
            (!candidate.revokedAt &&
              identifiers.refreshTokenHash === candidate.refreshTokenHash)
        );

        if (!session) {
          return null;
        }

        session.revokedAt = now;
        return session.userId;
      },
      revokeAllSessions: async (userId, now) => {
        let count = 0;

        for (const session of sessions.values()) {
          if (session.userId === userId && !session.revokedAt) {
            session.revokedAt = now;
            count += 1;
          }
        }

        return count;
      }
    };
  };

/* v8 ignore start -- exercised by the real PostgreSQL integration suite */
const purgeExpiredRefreshTombstones = async (
  transaction: Prisma.TransactionClient,
  now: Date
) => {
  await transaction.$executeRaw`
    DELETE FROM "auth_refresh_token_tombstones"
    WHERE "id" IN (
      SELECT "id"
      FROM "auth_refresh_token_tombstones"
      WHERE "expires_at" <= ${now}
      ORDER BY "expires_at" ASC
      LIMIT 100
    )
  `;

  const securityEventCutoff = new Date(
    now.getTime() - 365 * 24 * 60 * 60 * 1000
  );

  await transaction.$executeRaw`
    DELETE FROM "security_events"
    WHERE "id" IN (
      SELECT "id"
      FROM "security_events"
      WHERE "created_at" < ${securityEventCutoff}
      ORDER BY "created_at" ASC
      LIMIT 100
    )
  `;
};
/* v8 ignore stop */
