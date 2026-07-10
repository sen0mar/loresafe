import { prisma } from "../../core/prisma/client.js";

export type AuthSessionRecord = {
  userId: string;
  sessionIdHash: string;
  refreshTokenHash: string;
  sessionVersion: number;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type CreateAuthSessionInput = Omit<AuthSessionRecord, "revokedAt">;

export type AuthSessionsRepository = {
  createSession: (input: CreateAuthSessionInput) => Promise<AuthSessionRecord>;
  findActiveBySessionIdHash: (
    sessionIdHash: string,
    now: Date
  ) => Promise<AuthSessionRecord | null>;
  findActiveByRefreshTokenHash: (
    refreshTokenHash: string,
    now: Date
  ) => Promise<AuthSessionRecord | null>;
  hasSessionIdHash: (sessionIdHash: string) => Promise<boolean>;
  rotateRefreshToken: (
    sessionIdHash: string,
    currentRefreshTokenHash: string,
    nextSessionIdHash: string,
    nextRefreshTokenHash: string,
    now: Date
  ) => Promise<boolean>;
  revokeSession: (
    identifiers: { sessionIdHash?: string; refreshTokenHash?: string },
    now: Date
  ) => Promise<string | null>;
  revokeAllSessions: (userId: string, now: Date) => Promise<number>;
};

const sessionSelect = {
  userId: true,
  sessionIdHash: true,
  refreshTokenHash: true,
  sessionVersion: true,
  expiresAt: true,
  revokedAt: true
} as const;

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

  findActiveByRefreshTokenHash: (refreshTokenHash, now) =>
    prisma.authSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      select: sessionSelect
    }),

  hasSessionIdHash: async (sessionIdHash) =>
    (await prisma.authSession.count({ where: { sessionIdHash } })) > 0,

  rotateRefreshToken: async (
    sessionIdHash,
    currentRefreshTokenHash,
    nextSessionIdHash,
    nextRefreshTokenHash,
    now
  ) => {
    const result = await prisma.authSession.updateMany({
      where: {
        sessionIdHash,
        refreshTokenHash: currentRefreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      data: {
        sessionIdHash: nextSessionIdHash,
        refreshTokenHash: nextRefreshTokenHash,
        lastUsedAt: now
      }
    });

    return result.count === 1;
  },

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

export const createMemoryAuthSessionsRepository = (): AuthSessionsRepository => {
  const sessions = new Map<string, AuthSessionRecord>();
  const knownSessionIdHashes = new Set<string>();

  const findActive = (session: AuthSessionRecord | undefined, now: Date) =>
    session && !session.revokedAt && session.expiresAt > now ? session : null;

  return {
    createSession: async (input) => {
      const session = { ...input, revokedAt: null };
      sessions.set(input.sessionIdHash, session);
      knownSessionIdHashes.add(input.sessionIdHash);
      return session;
    },
    findActiveBySessionIdHash: async (sessionIdHash, now) =>
      findActive(sessions.get(sessionIdHash), now),
    findActiveByRefreshTokenHash: async (refreshTokenHash, now) =>
      findActive(
        [...sessions.values()].find(
          (session) => session.refreshTokenHash === refreshTokenHash
        ),
        now
      ),
    hasSessionIdHash: async (sessionIdHash) =>
      knownSessionIdHashes.has(sessionIdHash),
    rotateRefreshToken: async (
      sessionIdHash,
      currentRefreshTokenHash,
      nextSessionIdHash,
      nextRefreshTokenHash,
      now
    ) => {
      const session = findActive(sessions.get(sessionIdHash), now);

      if (!session || session.refreshTokenHash !== currentRefreshTokenHash) {
        return false;
      }

      session.refreshTokenHash = nextRefreshTokenHash;
      sessions.delete(sessionIdHash);
      session.sessionIdHash = nextSessionIdHash;
      sessions.set(nextSessionIdHash, session);
      knownSessionIdHashes.add(nextSessionIdHash);
      return true;
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
