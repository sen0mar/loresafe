import { HttpError } from "../../core/errors/http-error.js";
import { hashPassword, verifyPassword } from "../../core/security/password.js";
import {
  createRefreshToken,
  createSessionIdentifier,
  createSessionToken,
  hashSessionIdentifier,
  verifySessionToken
} from "../../core/security/session-token.js";
import { env } from "../../config/env.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { type AuthUserDto, toAuthUserDto } from "./auth.dto.js";
import type { LoginRequest, SignupRequest } from "./auth.schema.js";
import {
  authUsersRepository,
  type AuthUserRecord,
  type AuthUsersRepository,
  isUniqueConstraintError
} from "./auth.repository.js";
import {
  authSessionsRepository,
  createMemoryAuthSessionsRepository,
  type AuthSessionsRepository
} from "./auth-session.repository.js";

export type SignupResult = {
  user: AuthUserDto;
  sessionToken: string;
  refreshToken: string;
};

export type LoginResult = SignupResult;

export type AuthService = {
  signup: (input: SignupRequest) => Promise<SignupResult>;
  login: (input: LoginRequest) => Promise<LoginResult>;
  resolveCurrentUser: (
    sessionToken: string | undefined
  ) => Promise<AuthUserDto | null>;
  getCurrentUser: (sessionToken: string | undefined) => Promise<AuthUserDto>;
  refresh: (refreshToken: string | undefined) => Promise<LoginResult>;
  revokeSession: (input: {
    sessionToken?: string;
    refreshToken?: string;
  }) => Promise<string | null>;
  revokeAllSessions: (userId: string) => Promise<number>;
};

export const createAuthService = (
  usersRepository: AuthUsersRepository = authUsersRepository,
  sessionsRepository: AuthSessionsRepository =
    usersRepository === authUsersRepository
      ? authSessionsRepository
      : createMemoryAuthSessionsRepository()
): AuthService => {
  const allowLegacyUnpersistedTestTokens =
    env.NODE_ENV === "test" && usersRepository !== authUsersRepository;
  const resolveCurrentUser = async (sessionToken: string | undefined) => {
    if (!sessionToken) {
      return null;
    }

    const verifiedSession = await verifySessionToken(sessionToken);

    if (!verifiedSession) {
      return null;
    }

    const user = await usersRepository.findActiveUserById(
      verifiedSession.userId
    );
    const session = await sessionsRepository.findActiveBySessionIdHash(
      hashSessionIdentifier(verifiedSession.sessionId),
      new Date()
    );

    const isKnownPersistedSession =
      !session && allowLegacyUnpersistedTestTokens
        ? await sessionsRepository.hasSessionIdHash(
          hashSessionIdentifier(verifiedSession.sessionId)
          )
        : session !== null;

    if (
      !user ||
      (!session &&
        (!allowLegacyUnpersistedTestTokens || isKnownPersistedSession)) ||
      (session !== null && session.userId !== user.id) ||
      user.sessionVersion !== verifiedSession.sessionVersion
    ) {
      return null;
    }

    return toAuthUserDto(user);
  };

  return {
    signup: async ({ email, username, password }) => {
      const existingUser = await usersRepository.findActiveUserByEmail(email);

      if (existingUser) {
        throw duplicateEmailError();
      }

      const existingReservedName = usersRepository.findActiveUserByReservedName
        ? await usersRepository.findActiveUserByReservedName(
            normalizeNameReservationKey(username)
          )
        : null;

      if (existingReservedName) {
        throw duplicateUsernameError();
      }

      // Plaintext passwords should not cross into repositories or Prisma calls.
      const passwordHash = await hashPassword(password);

      try {
        const user = await usersRepository.createUser({
          email,
          displayName: username,
          username,
          passwordHash
        });
        const tokens = await createPersistedSession(
          user,
          sessionsRepository
        );

        return {
          user: toAuthUserDto(user),
          ...tokens
        };
      } catch (error) {
        // The database constraint closes the race where two signups pass the pre-check together.
        if (isUniqueConstraintError(error)) {
          throw duplicateSignupError(error);
        }

        throw error;
      }
    },

    login: async ({ email, password }) => {
      const user = await usersRepository.findActiveUserCredentialsByEmail(email);

      // Missing users and bad passwords share one response to avoid account enumeration.
      if (!user) {
        throw invalidCredentialsError();
      }

      const isPasswordValid = await verifyPassword(user.passwordHash, password);

      if (!isPasswordValid) {
        throw invalidCredentialsError();
      }

      const tokens = await createPersistedSession(user, sessionsRepository);

      return {
        user: toAuthUserDto(user),
        ...tokens
      };
    },

    refresh: async (refreshToken) => {
      if (!refreshToken) {
        throw authenticationRequiredError();
      }

      const currentRefreshTokenHash = hashSessionIdentifier(refreshToken);
      const session = await sessionsRepository.findActiveByRefreshTokenHash(
        currentRefreshTokenHash,
        new Date()
      );
      const user = session
        ? await usersRepository.findActiveUserById(session.userId)
        : null;

      if (
        !session ||
        !user ||
        session.sessionVersion !== user.sessionVersion
      ) {
        throw authenticationRequiredError();
      }

      const nextRefreshToken = createRefreshToken();
      const nextSessionId = createSessionIdentifier();
      const rotated = await sessionsRepository.rotateRefreshToken(
        session.sessionIdHash,
        currentRefreshTokenHash,
        hashSessionIdentifier(nextSessionId),
        hashSessionIdentifier(nextRefreshToken),
        new Date()
      );

      if (!rotated) {
        throw authenticationRequiredError();
      }

      return {
        user: toAuthUserDto(user),
        sessionToken: await createSessionToken({
          userId: user.id,
          sessionVersion: user.sessionVersion,
          sessionId: nextSessionId
        }),
        refreshToken: nextRefreshToken
      };
    },

    resolveCurrentUser,

    getCurrentUser: async (sessionToken) => {
      const user = await resolveCurrentUser(sessionToken);

      if (!user) {
        throw authenticationRequiredError();
      }

      return user;
    },

    revokeSession: async ({ sessionToken, refreshToken }) => {
      const verifiedSession = sessionToken
        ? await verifySessionToken(sessionToken)
        : null;
      const identifiers = {
        ...(verifiedSession
          ? {
              sessionIdHash: hashSessionIdentifier(verifiedSession.sessionId)
            }
          : {}),
        ...(refreshToken
          ? { refreshTokenHash: hashSessionIdentifier(refreshToken) }
          : {})
      };

      if (!identifiers.sessionIdHash && !identifiers.refreshTokenHash) {
        return null;
      }

      return sessionsRepository.revokeSession(identifiers, new Date());
    },

    revokeAllSessions: (userId) =>
      sessionsRepository.revokeAllSessions(userId, new Date())
  };
};

export const authService = createAuthService();

const createPersistedSession = async (
  user: Pick<AuthUserRecord, "id" | "sessionVersion">,
  sessionsRepository: AuthSessionsRepository
) => {
  const sessionId = createSessionIdentifier();
  const refreshToken = createRefreshToken();

  await sessionsRepository.createSession({
    userId: user.id,
    sessionIdHash: hashSessionIdentifier(sessionId),
    refreshTokenHash: hashSessionIdentifier(refreshToken),
    sessionVersion: user.sessionVersion,
    expiresAt: new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000)
  });

  return {
    sessionToken: await createSessionToken({
      userId: user.id,
      sessionVersion: user.sessionVersion,
      sessionId
    }),
    refreshToken
  };
};

const invalidCredentialsError = () =>
  new HttpError(401, "UNAUTHORIZED", "Invalid credentials");

const authenticationRequiredError = () =>
  new HttpError(401, "UNAUTHORIZED", "Authentication required");

const duplicateEmailError = () =>
  new HttpError(409, "CONFLICT", "An account with that email already exists.");

const duplicateUsernameError = () =>
  new HttpError(409, "CONFLICT", "That username is already taken.");

const duplicateSignupError = (error: unknown) => {
  const targets = uniqueConstraintTargets(error);

  if (targets.includes("email")) {
    return duplicateEmailError();
  }

  return duplicateUsernameError();
};

const uniqueConstraintTargets = (error: unknown) => {
  if (!error || typeof error !== "object" || !("meta" in error)) {
    return [];
  }

  const meta = (error as { meta?: { target?: unknown } }).meta;

  if (Array.isArray(meta?.target)) {
    return meta.target.filter((target): target is string => typeof target === "string");
  }

  return typeof meta?.target === "string" ? [meta.target] : [];
};
