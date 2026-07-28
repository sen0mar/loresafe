import { HttpError } from "../../core/errors/http-error.js";
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword
} from "../../core/security/password.js";
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
import type {
  ForgotPasswordRequest,
  LoginRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  SignupRequest,
  VerifyEmailRequest
} from "./auth.schema.js";
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
import {
  createMemoryEmailIdentityRepository,
  emailIdentityRepository,
  type EmailIdentityRepository
} from "./email-identity.repository.js";
import {
  createEmailIdentityToken,
  hashEmailIdentityToken
} from "./email-identity-token.js";
import { emailDelivery, type EmailDelivery } from "./email-delivery.js";

export type SignupResult = {
  accepted: true;
};

export type LoginResult = {
  user: AuthUserDto;
  sessionToken: string;
  refreshToken: string;
};

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
  resendVerification: (input: ResendVerificationRequest) => Promise<void>;
  verifyEmail: (input: VerifyEmailRequest) => Promise<void>;
  forgotPassword: (input: ForgotPasswordRequest) => Promise<void>;
  resetPassword: (input: ResetPasswordRequest) => Promise<string | null>;
};

type PasswordVerifier = typeof verifyPassword;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;

export const createAuthService = (
  usersRepository: AuthUsersRepository = authUsersRepository,
  sessionsRepository: AuthSessionsRepository = usersRepository ===
  authUsersRepository
    ? authSessionsRepository
    : createMemoryAuthSessionsRepository(),
  passwordVerifier: PasswordVerifier = verifyPassword,
  identityRepository: EmailIdentityRepository = usersRepository ===
  authUsersRepository
    ? emailIdentityRepository
    : createMemoryEmailIdentityRepository(),
  delivery: EmailDelivery = emailDelivery
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
      // Account existence never skips the signup Argon2id cost.
      const passwordHash = await hashPassword(password);
      const [existingUser, existingReservedName] = await Promise.all([
        usersRepository.findActiveUserByEmail(email),
        usersRepository.findActiveUserByReservedName
          ? usersRepository.findActiveUserByReservedName(
              normalizeNameReservationKey(username)
            )
          : Promise.resolve(null)
      ]);

      if (existingUser) {
        await issueIdentityToken({
          user: existingUser,
          purpose: "VERIFY_EMAIL",
          ttlMs: verificationTtlMs,
          identityRepository,
          delivery
        });

        return { accepted: true };
      }

      if (existingReservedName) {
        throw duplicateUsernameError();
      }

      try {
        const user = await usersRepository.createUser({
          email,
          displayName: username,
          username,
          passwordHash,
          emailVerifiedAt: null
        });
        await issueIdentityToken({
          user,
          purpose: "VERIFY_EMAIL",
          ttlMs: verificationTtlMs,
          identityRepository,
          delivery
        });

        return { accepted: true };
      } catch (error) {
        // The database constraint closes the race where two signups pass the pre-check together.
        if (isUniqueConstraintError(error)) {
          if (uniqueConstraintTargets(error).includes("email")) {
            return { accepted: true };
          }

          throw duplicateUsernameError();
        }

        throw error;
      }
    },

    login: async ({ email, password }) => {
      const user =
        await usersRepository.findActiveUserCredentialsByEmail(email);

      const isPasswordValid = await passwordVerifier(
        user?.passwordHash ?? dummyPasswordHash,
        password
      );

      // Keep both the work performed and the client response independent of
      // whether an active account exists for this email address.
      if (!user || user.emailVerifiedAt === null || !isPasswordValid) {
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

      if (!session || !user || session.sessionVersion !== user.sessionVersion) {
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
      sessionsRepository.revokeAllSessions(userId, new Date()),

    resendVerification: async ({ email }) => {
      await performNeutralIdentityWork();
      const user = await usersRepository.findActiveUserByEmail(email);

      if (user && user.emailVerifiedAt === null) {
        await issueIdentityToken({
          user,
          purpose: "VERIFY_EMAIL",
          ttlMs: verificationTtlMs,
          identityRepository,
          delivery
        });
      }
    },

    verifyEmail: async ({ token }) => {
      const result = await identityRepository.consumeVerificationToken(
        hashEmailIdentityToken(token),
        new Date()
      );

      if (result.status === "INVALID") {
        throw invalidIdentityTokenError();
      }
    },

    forgotPassword: async ({ email }) => {
      await performNeutralIdentityWork();
      const user = await usersRepository.findActiveUserByEmail(email);

      if (user && user.emailVerifiedAt !== null) {
        await issueIdentityToken({
          user,
          purpose: "RESET_PASSWORD",
          ttlMs: passwordResetTtlMs,
          identityRepository,
          delivery
        });
      }
    },

    resetPassword: async ({ token, password }) => {
      // Invalid, expired, consumed, and valid tokens all pay the Argon2id cost.
      const passwordHash = await hashPassword(password);
      const result = await identityRepository.consumePasswordResetToken({
        tokenHash: hashEmailIdentityToken(token),
        passwordHash,
        now: new Date()
      });

      if (result.status === "INVALID") {
        throw invalidIdentityTokenError();
      }

      return result.userId;
    }
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

const duplicateUsernameError = () =>
  new HttpError(409, "CONFLICT", "That username is already taken.");

const invalidIdentityTokenError = () =>
  new HttpError(
    400,
    "BAD_REQUEST",
    "This link is invalid or has expired. Request a new one."
  );

const uniqueConstraintTargets = (error: unknown) => {
  if (!error || typeof error !== "object" || !("meta" in error)) {
    return [];
  }

  const meta = (error as { meta?: { target?: unknown } }).meta;

  if (Array.isArray(meta?.target)) {
    return meta.target.filter(
      (target): target is string => typeof target === "string"
    );
  }

  return typeof meta?.target === "string" ? [meta.target] : [];
};

const performNeutralIdentityWork = () =>
  hashPassword(createEmailIdentityToken()).then(() => undefined);

const issueIdentityToken = async ({
  user,
  purpose,
  ttlMs,
  identityRepository,
  delivery
}: {
  user: Pick<AuthUserRecord, "id" | "email">;
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD";
  ttlMs: number;
  identityRepository: EmailIdentityRepository;
  delivery: EmailDelivery;
}) => {
  const token = createEmailIdentityToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await identityRepository.issueToken({
    userId: user.id,
    purpose,
    tokenHash: hashEmailIdentityToken(token),
    expiresAt
  });

  if (purpose === "VERIFY_EMAIL") {
    await delivery
      .sendEmailVerification({
        email: user.email,
        token,
        expiresAt
      })
      .catch(() => undefined);
  } else {
    await delivery
      .sendPasswordReset({ email: user.email, token, expiresAt })
      .catch(() => undefined);
  }
};
